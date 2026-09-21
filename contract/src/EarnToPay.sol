// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EarnToPay
 * @notice Complete Task → Admin Verifies → Earn BOT → Pay Merchants or Withdraw
 * @dev Manages earning tasks, completions, reward pool, earned balances, user withdrawals, and payment requests.
 *      All privileged functions require msg.sender == admin.
 *      Native BOT on Bohr Testnet (Chain ID 968).
 */
contract EarnToPay is ReentrancyGuard {
    // =========================================================
    // STATE
    // =========================================================

    address public admin;

    // Reward pool accounting (contract holds native BOT)
    uint256 public rewardPool;          // Available BOT for future rewards
    uint256 public totalRewardsIssued;  // Cumulative BOT distributed as rewards
    uint256 public totalPaymentsVolume; // Cumulative BOT processed via payments

    // User balances
    mapping(address => uint256) public earnedBalance;  // Available to spend or withdraw
    mapping(address => uint256) public totalEarned;    // Lifetime earned
    mapping(address => uint256) public totalSpent;     // Lifetime spent on payments
    mapping(address => uint256) public totalWithdrawn; // Lifetime withdrawn to wallet

    // =========================================================
    // TASKS
    // =========================================================

    struct Task {
        uint256 id;
        string title;
        string description;
        string requirement;
        uint256 reward;        // in wei (native BOT)
        bool active;
        uint256 createdAt;
    }

    uint256 public taskCount;
    mapping(uint256 => Task) public tasks;

    // =========================================================
    // COMPLETIONS
    // =========================================================

    struct Completion {
        address user;
        uint256 taskId;
        bool submitted;
        bool approved;
        bool rewarded;
        uint256 submittedAt;
        string proofNote;    // Optional note/proof from user
    }

    // key = keccak256(abi.encodePacked(user, taskId))
    mapping(bytes32 => Completion) public completions;

    // =========================================================
    // PAYMENT REQUESTS
    // =========================================================

    struct PaymentRequest {
        uint256 id;
        address payable merchant;
        uint256 amount;       // in wei (native BOT)
        string title;
        string description;
        uint256 deadline;     // 0 = no deadline
        bool paid;
        bool active;
        address paidBy;
        uint256 createdAt;
    }

    uint256 public paymentRequestCount;
    mapping(uint256 => PaymentRequest) public paymentRequests;

    // =========================================================
    // EVENTS
    // =========================================================

    event TaskCreated(uint256 indexed taskId, string title, uint256 reward, uint256 timestamp);
    event TaskUpdated(uint256 indexed taskId, bool active);
    event CompletionSubmitted(address indexed user, uint256 indexed taskId, uint256 timestamp);
    event CompletionApproved(address indexed user, uint256 indexed taskId, address indexed approvedBy);
    event RewardIssued(address indexed user, uint256 indexed taskId, uint256 amount, uint256 timestamp);
    event RewardPoolFunded(address indexed funder, uint256 amount, uint256 newTotal);
    event RewardWithdrawn(address indexed user, uint256 amount, address indexed destination, uint256 timestamp);
    event PaymentRequestCreated(uint256 indexed requestId, address indexed merchant, uint256 amount, string title, uint256 timestamp);
    event PaymentCompleted(uint256 indexed requestId, address indexed payer, address indexed merchant, uint256 amount, uint256 timestamp);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);

    // =========================================================
    // ERRORS
    // =========================================================

    error NotAdmin();
    error TaskNotFound(uint256 taskId);
    error TaskNotActive(uint256 taskId);
    error AlreadySubmitted(address user, uint256 taskId);
    error NotSubmitted(address user, uint256 taskId);
    error AlreadyApproved(address user, uint256 taskId);
    error AlreadyRewarded(address user, uint256 taskId);
    error NotApproved(address user, uint256 taskId);
    error InsufficientRewardPool(uint256 required, uint256 available);
    error PaymentRequestNotFound(uint256 requestId);
    error PaymentRequestNotActive(uint256 requestId);
    error PaymentRequestExpired(uint256 requestId);
    error PaymentRequestAlreadyPaid(uint256 requestId);
    error InsufficientEarnedBalance(uint256 required, uint256 available);
    error InsufficientContractBalance(uint256 required, uint256 available);
    error InvalidAmount();
    error InvalidAddress();
    error TransferFailed();
    error InsufficientWithdrawable();

    // =========================================================
    // MODIFIERS
    // =========================================================

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    // =========================================================
    // CONSTRUCTOR
    // =========================================================

    constructor() {
        admin = msg.sender;
    }

    // =========================================================
    // ADMIN — FUND REWARD POOL
    // =========================================================

    /**
     * @notice Fund the reward pool with native BOT. Admin or anyone can fund.
     */
    function fundRewardPool() external payable {
        if (msg.value == 0) revert InvalidAmount();
        rewardPool += msg.value;
        emit RewardPoolFunded(msg.sender, msg.value, rewardPool);
    }

    // =========================================================
    // ADMIN — TASK MANAGEMENT
    // =========================================================

    /**
     * @notice Create a new earning task. Admin only.
     * @param title Human-readable task title
     * @param description Detailed task description
     * @param requirement What the user must do/prove
     * @param reward BOT reward in wei
     */
    function createTask(
        string calldata title,
        string calldata description,
        string calldata requirement,
        uint256 reward
    ) external onlyAdmin returns (uint256 taskId) {
        if (reward == 0) revert InvalidAmount();
        if (bytes(title).length == 0) revert InvalidAmount();

        taskId = ++taskCount;
        tasks[taskId] = Task({
            id: taskId,
            title: title,
            description: description,
            requirement: requirement,
            reward: reward,
            active: true,
            createdAt: block.timestamp
        });

        emit TaskCreated(taskId, title, reward, block.timestamp);
    }

    /**
     * @notice Activate or deactivate a task. Admin only.
     */
    function setTaskActive(uint256 taskId, bool active) external onlyAdmin {
        if (tasks[taskId].id == 0) revert TaskNotFound(taskId);
        tasks[taskId].active = active;
        emit TaskUpdated(taskId, active);
    }

    /**
     * @notice Update task details. Admin only.
     */
    function updateTask(
        uint256 taskId,
        string calldata title,
        string calldata description,
        string calldata requirement,
        uint256 reward
    ) external onlyAdmin {
        if (tasks[taskId].id == 0) revert TaskNotFound(taskId);
        if (reward == 0) revert InvalidAmount();
        tasks[taskId].title = title;
        tasks[taskId].description = description;
        tasks[taskId].requirement = requirement;
        tasks[taskId].reward = reward;
        emit TaskUpdated(taskId, tasks[taskId].active);
    }

    // =========================================================
    // ADMIN — COMPLETION APPROVAL + REWARD ISSUANCE
    // =========================================================

    /**
     * @notice Approve a user's task completion. Does NOT issue reward yet.
     * @dev Two-step: approve first, then issue reward separately.
     */
    function approveCompletion(address user, uint256 taskId) external onlyAdmin {
        if (user == address(0)) revert InvalidAddress();
        if (tasks[taskId].id == 0) revert TaskNotFound(taskId);

        bytes32 key = _completionKey(user, taskId);
        Completion storage c = completions[key];

        if (!c.submitted) revert NotSubmitted(user, taskId);
        if (c.approved) revert AlreadyApproved(user, taskId);

        c.approved = true;
        emit CompletionApproved(user, taskId, msg.sender);
    }

    /**
     * @notice Issue the BOT reward for an approved completion. Admin only.
     * @dev Transfers from rewardPool to user's earnedBalance.
     *      Reverts if rewardPool is insufficient.
     */
    function issueReward(address user, uint256 taskId) external onlyAdmin {
        if (user == address(0)) revert InvalidAddress();
        if (tasks[taskId].id == 0) revert TaskNotFound(taskId);

        bytes32 key = _completionKey(user, taskId);
        Completion storage c = completions[key];

        if (!c.approved) revert NotApproved(user, taskId);
        if (c.rewarded) revert AlreadyRewarded(user, taskId);

        uint256 reward = tasks[taskId].reward;
        if (rewardPool < reward) revert InsufficientRewardPool(reward, rewardPool);

        // Effects before interactions
        c.rewarded = true;
        rewardPool -= reward;
        totalRewardsIssued += reward;
        earnedBalance[user] += reward;
        totalEarned[user] += reward;

        emit RewardIssued(user, taskId, reward, block.timestamp);
    }

    /**
     * @notice Admin can approve AND issue reward in one tx (convenience).
     */
    function approveAndIssueReward(address user, uint256 taskId) external onlyAdmin {
        if (user == address(0)) revert InvalidAddress();
        if (tasks[taskId].id == 0) revert TaskNotFound(taskId);

        bytes32 key = _completionKey(user, taskId);
        Completion storage c = completions[key];

        if (!c.submitted) revert NotSubmitted(user, taskId);
        if (c.rewarded) revert AlreadyRewarded(user, taskId);

        uint256 reward = tasks[taskId].reward;
        if (rewardPool < reward) revert InsufficientRewardPool(reward, rewardPool);

        c.approved = true;
        c.rewarded = true;
        rewardPool -= reward;
        totalRewardsIssued += reward;
        earnedBalance[user] += reward;
        totalEarned[user] += reward;

        emit CompletionApproved(user, taskId, msg.sender);
        emit RewardIssued(user, taskId, reward, block.timestamp);
    }

    /**
     * @notice Admin-only withdrawal of unallocated reward pool BOT.
     * @dev Cannot withdraw BOT committed to users' earnedBalances.
     */
    function withdrawUnallocated(uint256 amount) external nonReentrant onlyAdmin {
        if (amount == 0) revert InvalidAmount();
        if (amount > rewardPool) revert InsufficientWithdrawable();

        rewardPool -= amount;

        (bool success, ) = payable(admin).call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    /**
     * @notice Transfer admin rights. Admin only.
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidAddress();
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    // =========================================================
    // USER — TASK COMPLETION SUBMISSION
    // =========================================================

    /**
     * @notice Submit a task completion. Records submission for admin review.
     * @param taskId The task being completed
     * @param proofNote Optional note or proof reference
     */
    function submitCompletion(uint256 taskId, string calldata proofNote) external {
        if (tasks[taskId].id == 0) revert TaskNotFound(taskId);
        if (!tasks[taskId].active) revert TaskNotActive(taskId);

        bytes32 key = _completionKey(msg.sender, taskId);
        if (completions[key].submitted) revert AlreadySubmitted(msg.sender, taskId);

        completions[key] = Completion({
            user: msg.sender,
            taskId: taskId,
            submitted: true,
            approved: false,
            rewarded: false,
            submittedAt: block.timestamp,
            proofNote: proofNote
        });

        emit CompletionSubmitted(msg.sender, taskId, block.timestamp);
    }

    // =========================================================
    // USER — WITHDRAW EARNED BOT
    // =========================================================

    /**
     * @notice Withdraw approved earned BOT balance to msg.sender's wallet.
     * @param amount BOT amount to withdraw in wei. Must be > 0 and <= earnedBalance[msg.sender].
     */
    function withdrawEarned(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        uint256 balance = earnedBalance[msg.sender];
        if (balance < amount) revert InsufficientEarnedBalance(amount, balance);
        if (address(this).balance < amount) revert InsufficientContractBalance(amount, address(this).balance);

        // CHECKS-EFFECTS-INTERACTIONS
        earnedBalance[msg.sender] -= amount;
        totalWithdrawn[msg.sender] += amount;

        emit RewardWithdrawn(msg.sender, amount, msg.sender, block.timestamp);

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    // =========================================================
    // MERCHANT — PAYMENT REQUESTS
    // =========================================================

    /**
     * @notice Create a payment request. Any connected wallet can create.
     * @param amount BOT amount in wei
     * @param title Product/service title
     * @param description Detailed description
     * @param deadline Unix timestamp deadline, 0 = no deadline
     */
    function createPaymentRequest(
        uint256 amount,
        string calldata title,
        string calldata description,
        uint256 deadline
    ) external returns (uint256 requestId) {
        if (amount == 0) revert InvalidAmount();
        if (bytes(title).length == 0) revert InvalidAmount();
        if (deadline != 0 && deadline <= block.timestamp) revert InvalidAmount();

        requestId = ++paymentRequestCount;
        paymentRequests[requestId] = PaymentRequest({
            id: requestId,
            merchant: payable(msg.sender),
            amount: amount,
            title: title,
            description: description,
            deadline: deadline,
            paid: false,
            active: true,
            paidBy: address(0),
            createdAt: block.timestamp
        });

        emit PaymentRequestCreated(requestId, msg.sender, amount, title, block.timestamp);
    }

    /**
     * @notice Deactivate a payment request you created.
     */
    function deactivatePaymentRequest(uint256 requestId) external {
        PaymentRequest storage req = paymentRequests[requestId];
        if (req.id == 0) revert PaymentRequestNotFound(requestId);
        if (req.merchant != payable(msg.sender) && msg.sender != admin) revert NotAdmin();
        req.active = false;
    }

    // =========================================================
    // USER — PAY PAYMENT REQUEST
    // =========================================================

    /**
     * @notice Pay a payment request using earned BOT balance.
     * @dev Deducts earnedBalance, transfers native BOT to merchant atomically.
     *      Uses checks-effects-interactions pattern with reentrancy guard.
     */
    function payRequest(uint256 requestId) external nonReentrant {
        PaymentRequest storage req = paymentRequests[requestId];

        if (req.id == 0) revert PaymentRequestNotFound(requestId);
        if (!req.active) revert PaymentRequestNotActive(requestId);
        if (req.paid) revert PaymentRequestAlreadyPaid(requestId);
        if (req.deadline != 0 && block.timestamp > req.deadline) revert PaymentRequestExpired(requestId);

        uint256 amount = req.amount;
        uint256 balance = earnedBalance[msg.sender];
        if (balance < amount) revert InsufficientEarnedBalance(amount, balance);

        // CHECKS-EFFECTS-INTERACTIONS
        // Effects
        req.paid = true;
        req.active = false;
        req.paidBy = msg.sender;
        earnedBalance[msg.sender] -= amount;
        totalSpent[msg.sender] += amount;
        totalPaymentsVolume += amount;

        // Interaction — transfer native BOT to merchant
        address payable merchant = req.merchant;
        emit PaymentCompleted(requestId, msg.sender, merchant, amount, block.timestamp);
        (bool success, ) = merchant.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    // =========================================================
    // VIEW FUNCTIONS
    // =========================================================

    /**
     * @notice Get task by ID
     */
    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    /**
     * @notice Get all tasks (paginated)
     */
    function getTasks(uint256 fromId, uint256 count) external view returns (Task[] memory) {
        uint256 total = taskCount;
        if (fromId == 0) fromId = 1;
        uint256 end = fromId + count - 1;
        if (end > total) end = total;

        if (fromId > total) return new Task[](0);

        Task[] memory result = new Task[](end - fromId + 1);
        for (uint256 i = fromId; i <= end; i++) {
            result[i - fromId] = tasks[i];
        }
        return result;
    }

    /**
     * @notice Get payment request by ID
     */
    function getPaymentRequest(uint256 requestId) external view returns (PaymentRequest memory) {
        return paymentRequests[requestId];
    }

    /**
     * @notice Get all payment requests (paginated)
     */
    function getPaymentRequests(uint256 fromId, uint256 count) external view returns (PaymentRequest[] memory) {
        uint256 total = paymentRequestCount;
        if (fromId == 0) fromId = 1;
        uint256 end = fromId + count - 1;
        if (end > total) end = total;

        if (fromId > total) return new PaymentRequest[](0);

        PaymentRequest[] memory result = new PaymentRequest[](end - fromId + 1);
        for (uint256 i = fromId; i <= end; i++) {
            result[i - fromId] = paymentRequests[i];
        }
        return result;
    }

    /**
     * @notice Get completion record
     */
    function getCompletion(address user, uint256 taskId) external view returns (Completion memory) {
        return completions[_completionKey(user, taskId)];
    }

    /**
     * @notice Get user's earned balance
     */
    function balanceOf(address user) external view returns (uint256) {
        return earnedBalance[user];
    }

    /**
     * @notice Get contract's total native BOT balance
     */
    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Get platform summary
     */
    function getPlatformStats() external view returns (
        uint256 _taskCount,
        uint256 _paymentRequestCount,
        uint256 _rewardPool,
        uint256 _totalRewardsIssued,
        uint256 _totalPaymentsVolume,
        uint256 _contractBalance
    ) {
        return (
            taskCount,
            paymentRequestCount,
            rewardPool,
            totalRewardsIssued,
            totalPaymentsVolume,
            address(this).balance
        );
    }

    // =========================================================
    // INTERNAL
    // =========================================================

    function _completionKey(address user, uint256 taskId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(user, taskId));
    }

    /**
     * @notice Allow contract to receive native BOT
     */
    receive() external payable {
        rewardPool += msg.value;
        emit RewardPoolFunded(msg.sender, msg.value, rewardPool);
    }
}
