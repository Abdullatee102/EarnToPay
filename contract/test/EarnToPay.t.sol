// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/EarnToPay.sol";

contract EarnToPayTest is Test {
    EarnToPay public earnToPay;

    address public admin;
    address public user1;
    address public user2;
    address public merchant;
    address public unauthorized;

    uint256 constant ONE_BOT = 1 ether;
    uint256 constant TEN_BOT = 10 ether;
    uint256 constant TWENTY_BOT = 20 ether;
    uint256 constant REWARD_POOL_INITIAL = 100 ether;

    function setUp() public {
        admin = makeAddr("admin");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        merchant = makeAddr("merchant");
        unauthorized = makeAddr("unauthorized");

        // Deploy as admin
        vm.prank(admin);
        earnToPay = new EarnToPay();

        // Fund admin with test BOT
        vm.deal(admin, 200 ether);
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.deal(merchant, 5 ether);

        // Fund reward pool
        vm.prank(admin);
        earnToPay.fundRewardPool{value: REWARD_POOL_INITIAL}();
    }

    // =========================================================
    // ADMIN TESTS
    // =========================================================

    function test_AdminIsDeployer() public view {
        assertEq(earnToPay.admin(), admin);
    }

    function test_AdminCanCreateTask() public {
        vm.prank(admin);
        uint256 taskId = earnToPay.createTask(
            "Web3 Quiz",
            "Complete the Web3 beginner quiz",
            "Score at least 80%",
            TEN_BOT
        );
        assertEq(taskId, 1);
        assertEq(earnToPay.taskCount(), 1);

        EarnToPay.Task memory t = earnToPay.getTask(1);
        assertEq(t.title, "Web3 Quiz");
        assertEq(t.reward, TEN_BOT);
        assertTrue(t.active);
    }

    function test_UnauthorizedCannotCreateTask() public {
        vm.prank(unauthorized);
        vm.expectRevert(EarnToPay.NotAdmin.selector);
        earnToPay.createTask("Bad Task", "desc", "req", TEN_BOT);
    }

    function test_AdminCanSetTaskActive() public {
        vm.prank(admin);
        earnToPay.createTask("Task A", "desc", "req", ONE_BOT);

        vm.prank(admin);
        earnToPay.setTaskActive(1, false);

        EarnToPay.Task memory t = earnToPay.getTask(1);
        assertFalse(t.active);
    }

    function test_UnauthorizedCannotSetTaskActive() public {
        vm.prank(admin);
        earnToPay.createTask("Task A", "desc", "req", ONE_BOT);

        vm.prank(unauthorized);
        vm.expectRevert(EarnToPay.NotAdmin.selector);
        earnToPay.setTaskActive(1, false);
    }

    function test_AdminCanUpdateTask() public {
        vm.prank(admin);
        earnToPay.createTask("Old Title", "old desc", "old req", ONE_BOT);

        vm.prank(admin);
        earnToPay.updateTask(1, "New Title", "new desc", "new req", TWENTY_BOT);

        EarnToPay.Task memory t = earnToPay.getTask(1);
        assertEq(t.title, "New Title");
        assertEq(t.reward, TWENTY_BOT);
    }

    function test_UnauthorizedCannotUpdateTask() public {
        vm.prank(admin);
        earnToPay.createTask("Task A", "desc", "req", ONE_BOT);

        vm.prank(unauthorized);
        vm.expectRevert(EarnToPay.NotAdmin.selector);
        earnToPay.updateTask(1, "Hacked", "hacked", "hacked", TWENTY_BOT);
    }

    function test_UnauthorizedCannotApproveCompletion() public {
        vm.prank(admin);
        earnToPay.createTask("Task A", "desc", "req", ONE_BOT);

        vm.prank(user1);
        earnToPay.submitCompletion(1, "proof");

        vm.prank(unauthorized);
        vm.expectRevert(EarnToPay.NotAdmin.selector);
        earnToPay.approveCompletion(user1, 1);
    }

    function test_UnauthorizedCannotIssueReward() public {
        vm.prank(admin);
        earnToPay.createTask("Task A", "desc", "req", ONE_BOT);

        vm.prank(user1);
        earnToPay.submitCompletion(1, "proof");

        vm.prank(admin);
        earnToPay.approveCompletion(user1, 1);

        vm.prank(unauthorized);
        vm.expectRevert(EarnToPay.NotAdmin.selector);
        earnToPay.issueReward(user1, 1);
    }

    // =========================================================
    // TASK TESTS
    // =========================================================

    function test_CreateTaskIncreasesCount() public {
        vm.prank(admin);
        earnToPay.createTask("T1", "d", "r", ONE_BOT);
        vm.prank(admin);
        earnToPay.createTask("T2", "d", "r", ONE_BOT);
        assertEq(earnToPay.taskCount(), 2);
    }

    function test_CreateTaskWithZeroRewardReverts() public {
        vm.prank(admin);
        vm.expectRevert(EarnToPay.InvalidAmount.selector);
        earnToPay.createTask("Task", "d", "r", 0);
    }

    function test_CreateTaskWithEmptyTitleReverts() public {
        vm.prank(admin);
        vm.expectRevert(EarnToPay.InvalidAmount.selector);
        earnToPay.createTask("", "d", "r", ONE_BOT);
    }

    function test_CannotSubmitInactiveTask() public {
        vm.prank(admin);
        earnToPay.createTask("Task A", "desc", "req", ONE_BOT);

        vm.prank(admin);
        earnToPay.setTaskActive(1, false);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(EarnToPay.TaskNotActive.selector, 1));
        earnToPay.submitCompletion(1, "proof");
    }

    function test_CannotSubmitNonExistentTask() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(EarnToPay.TaskNotFound.selector, 999));
        earnToPay.submitCompletion(999, "proof");
    }

    function test_DuplicateSubmissionReverts() public {
        vm.prank(admin);
        earnToPay.createTask("Task A", "desc", "req", ONE_BOT);

        vm.prank(user1);
        earnToPay.submitCompletion(1, "proof");

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(EarnToPay.AlreadySubmitted.selector, user1, 1));
        earnToPay.submitCompletion(1, "proof again");
    }

    function test_GetTasksPaginated() public {
        vm.startPrank(admin);
        earnToPay.createTask("T1", "d", "r", ONE_BOT);
        earnToPay.createTask("T2", "d", "r", ONE_BOT);
        earnToPay.createTask("T3", "d", "r", ONE_BOT);
        vm.stopPrank();

        EarnToPay.Task[] memory allTasks = earnToPay.getTasks(1, 3);
        assertEq(allTasks.length, 3);
        assertEq(allTasks[0].title, "T1");
        assertEq(allTasks[2].title, "T3");
    }

    // =========================================================
    // REWARD POOL TESTS
    // =========================================================

    function test_FundRewardPool() public {
        uint256 initialPool = earnToPay.rewardPool();
        vm.prank(user1);
        earnToPay.fundRewardPool{value: ONE_BOT}();
        assertEq(earnToPay.rewardPool(), initialPool + ONE_BOT);
    }

    function test_FundWithZeroReverts() public {
        vm.prank(admin);
        vm.expectRevert(EarnToPay.InvalidAmount.selector);
        earnToPay.fundRewardPool{value: 0}();
    }

    function test_RewardPoolDecreaseOnRewardIssued() public {
        vm.prank(admin);
        earnToPay.createTask("Task A", "desc", "req", TEN_BOT);

        vm.prank(user1);
        earnToPay.submitCompletion(1, "done");

        uint256 poolBefore = earnToPay.rewardPool();

        vm.prank(admin);
        earnToPay.approveCompletion(user1, 1);

        vm.prank(admin);
        earnToPay.issueReward(user1, 1);

        assertEq(earnToPay.rewardPool(), poolBefore - TEN_BOT);
    }

    function test_InsufficientRewardPoolReverts() public {
        // Deploy fresh contract with tiny pool
        vm.prank(admin);
        EarnToPay freshContract = new EarnToPay();
        vm.prank(admin);
        freshContract.fundRewardPool{value: ONE_BOT}();

        // Create task with reward > pool
        vm.prank(admin);
        freshContract.createTask("Big Task", "desc", "req", TWENTY_BOT);

        vm.prank(user1);
        freshContract.submitCompletion(1, "done");

        vm.prank(admin);
        freshContract.approveCompletion(user1, 1);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(EarnToPay.InsufficientRewardPool.selector, TWENTY_BOT, ONE_BOT));
        freshContract.issueReward(user1, 1);
    }

    // =========================================================
    // REWARD TESTS
    // =========================================================

    function test_FullRewardFlow() public {
        vm.prank(admin);
        earnToPay.createTask("Quiz", "desc", "req", TEN_BOT);

        vm.prank(user1);
        earnToPay.submitCompletion(1, "proof of completion");

        // Verify submitted
        EarnToPay.Completion memory c = earnToPay.getCompletion(user1, 1);
        assertTrue(c.submitted);
        assertFalse(c.approved);
        assertFalse(c.rewarded);

        vm.prank(admin);
        earnToPay.approveCompletion(user1, 1);

        c = earnToPay.getCompletion(user1, 1);
        assertTrue(c.approved);
        assertFalse(c.rewarded);

        vm.prank(admin);
        earnToPay.issueReward(user1, 1);

        c = earnToPay.getCompletion(user1, 1);
        assertTrue(c.rewarded);

        assertEq(earnToPay.earnedBalance(user1), TEN_BOT);
        assertEq(earnToPay.totalEarned(user1), TEN_BOT);
        assertEq(earnToPay.totalRewardsIssued(), TEN_BOT);
    }

    function test_CannotIssueRewardWithoutApproval() public {
        vm.prank(admin);
        earnToPay.createTask("Task", "d", "r", TEN_BOT);

        vm.prank(user1);
        earnToPay.submitCompletion(1, "proof");

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(EarnToPay.NotApproved.selector, user1, 1));
        earnToPay.issueReward(user1, 1);
    }

    function test_CannotRewardTwice() public {
        vm.prank(admin);
        earnToPay.createTask("Task", "d", "r", TEN_BOT);

        vm.prank(user1);
        earnToPay.submitCompletion(1, "proof");

        vm.prank(admin);
        earnToPay.approveCompletion(user1, 1);

        vm.prank(admin);
        earnToPay.issueReward(user1, 1);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(EarnToPay.AlreadyRewarded.selector, user1, 1));
        earnToPay.issueReward(user1, 1);
    }

    function test_CannotApproveWithoutSubmission() public {
        vm.prank(admin);
        earnToPay.createTask("Task", "d", "r", TEN_BOT);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(EarnToPay.NotSubmitted.selector, user1, 1));
        earnToPay.approveCompletion(user1, 1);
    }

    function test_ApproveAndIssueRewardOneStep() public {
        vm.prank(admin);
        earnToPay.createTask("Task", "d", "r", TEN_BOT);

        vm.prank(user1);
        earnToPay.submitCompletion(1, "done");

        vm.prank(admin);
        earnToPay.approveAndIssueReward(user1, 1);

        assertEq(earnToPay.earnedBalance(user1), TEN_BOT);
    }

    function test_UserBalanceCorrectWithMultipleTasks() public {
        vm.startPrank(admin);
        earnToPay.createTask("Task1", "d", "r", TEN_BOT);
        earnToPay.createTask("Task2", "d", "r", TWENTY_BOT);
        vm.stopPrank();

        vm.prank(user1);
        earnToPay.submitCompletion(1, "p1");
        vm.prank(user1);
        earnToPay.submitCompletion(2, "p2");

        vm.prank(admin);
        earnToPay.approveAndIssueReward(user1, 1);
        vm.prank(admin);
        earnToPay.approveAndIssueReward(user1, 2);

        assertEq(earnToPay.earnedBalance(user1), TEN_BOT + TWENTY_BOT);
        assertEq(earnToPay.totalEarned(user1), TEN_BOT + TWENTY_BOT);
    }

    // =========================================================
    // PAYMENT TESTS
    // =========================================================

    function _setupUserWithBalance(address user, uint256 taskReward) internal returns (uint256 taskId) {
        vm.prank(admin);
        taskId = earnToPay.createTask("Task", "d", "r", taskReward);

        vm.prank(user);
        earnToPay.submitCompletion(taskId, "done");

        vm.prank(admin);
        earnToPay.approveAndIssueReward(user, taskId);
    }

    function test_FullPaymentFlow() public {
        _setupUserWithBalance(user1, TEN_BOT);

        // Merchant creates payment request
        vm.prank(merchant);
        uint256 requestId = earnToPay.createPaymentRequest(TEN_BOT, "Web3 Course", "Learn Web3", 0);
        assertEq(requestId, 1);

        uint256 merchantBalanceBefore = merchant.balance;

        // User pays
        vm.prank(user1);
        earnToPay.payRequest(1);

        // Verify state
        assertEq(earnToPay.earnedBalance(user1), 0);
        assertEq(earnToPay.totalSpent(user1), TEN_BOT);
        assertEq(merchant.balance, merchantBalanceBefore + TEN_BOT);

        EarnToPay.PaymentRequest memory req = earnToPay.getPaymentRequest(1);
        assertTrue(req.paid);
        assertFalse(req.active);
        assertEq(req.paidBy, user1);
    }

    function test_InsufficientEarnedBalanceReverts() public {
        _setupUserWithBalance(user1, TEN_BOT);

        vm.prank(merchant);
        earnToPay.createPaymentRequest(TWENTY_BOT, "Expensive", "desc", 0);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(EarnToPay.InsufficientEarnedBalance.selector, TWENTY_BOT, TEN_BOT));
        earnToPay.payRequest(1);
    }

    function test_CannotPaySameRequestTwice() public {
        _setupUserWithBalance(user1, TWENTY_BOT);
        _setupUserWithBalance(user2, TWENTY_BOT);

        vm.prank(merchant);
        earnToPay.createPaymentRequest(TEN_BOT, "Product", "desc", 0);

        vm.prank(user1);
        earnToPay.payRequest(1);

        vm.prank(user2);
        // After payment, req.active = false, so we get NotActive before AlreadyPaid check
        vm.expectRevert(abi.encodeWithSelector(EarnToPay.PaymentRequestNotActive.selector, 1));
        earnToPay.payRequest(1);
    }

    function test_CannotPayExpiredRequest() public {
        _setupUserWithBalance(user1, TEN_BOT);

        uint256 deadline = block.timestamp + 3600;
        vm.prank(merchant);
        earnToPay.createPaymentRequest(TEN_BOT, "Flash Sale", "desc", deadline);

        // Fast-forward past deadline
        vm.warp(block.timestamp + 3601);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(EarnToPay.PaymentRequestExpired.selector, 1));
        earnToPay.payRequest(1);
    }

    function test_CannotPayInactiveRequest() public {
        _setupUserWithBalance(user1, TEN_BOT);

        vm.prank(merchant);
        earnToPay.createPaymentRequest(TEN_BOT, "Product", "desc", 0);

        // Merchant deactivates
        vm.prank(merchant);
        earnToPay.deactivatePaymentRequest(1);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(EarnToPay.PaymentRequestNotActive.selector, 1));
        earnToPay.payRequest(1);
    }

    function test_CannotPayNonExistentRequest() public {
        _setupUserWithBalance(user1, TEN_BOT);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(EarnToPay.PaymentRequestNotFound.selector, 999));
        earnToPay.payRequest(999);
    }

    function test_MerchantReceivesCorrectAmount() public {
        _setupUserWithBalance(user1, TWENTY_BOT);

        uint256 payAmount = 15 ether;
        vm.prank(merchant);
        earnToPay.createPaymentRequest(payAmount, "Service", "desc", 0);

        uint256 merchantBefore = merchant.balance;

        vm.prank(user1);
        earnToPay.payRequest(1);

        assertEq(merchant.balance, merchantBefore + payAmount);
        assertEq(earnToPay.earnedBalance(user1), TWENTY_BOT - payAmount);
    }

    function test_ZeroAmountPaymentRequestReverts() public {
        vm.prank(merchant);
        vm.expectRevert(EarnToPay.InvalidAmount.selector);
        earnToPay.createPaymentRequest(0, "Free", "desc", 0);
    }

    function test_EmptyTitlePaymentRequestReverts() public {
        vm.prank(merchant);
        vm.expectRevert(EarnToPay.InvalidAmount.selector);
        earnToPay.createPaymentRequest(ONE_BOT, "", "desc", 0);
    }

    function test_BalanceDoesNotGoNegative() public {
        _setupUserWithBalance(user1, TEN_BOT);

        // Pay 6 BOT
        vm.prank(merchant);
        earnToPay.createPaymentRequest(6 ether, "Product 1", "desc", 0);
        vm.prank(user1);
        earnToPay.payRequest(1);

        assertEq(earnToPay.earnedBalance(user1), 4 ether);

        // Try to pay 5 BOT (only 4 available)
        vm.prank(merchant);
        earnToPay.createPaymentRequest(5 ether, "Product 2", "desc", 0);
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(EarnToPay.InsufficientEarnedBalance.selector, 5 ether, 4 ether));
        earnToPay.payRequest(2);
    }

    function test_PaymentEventEmitted() public {
        _setupUserWithBalance(user1, TEN_BOT);

        vm.prank(merchant);
        earnToPay.createPaymentRequest(TEN_BOT, "Course", "desc", 0);

        vm.expectEmit(true, true, true, false);
        emit EarnToPay.PaymentCompleted(1, user1, merchant, TEN_BOT, block.timestamp);

        vm.prank(user1);
        earnToPay.payRequest(1);
    }

    function test_RewardEventEmitted() public {
        vm.prank(admin);
        earnToPay.createTask("Task", "d", "r", TEN_BOT);
        vm.prank(user1);
        earnToPay.submitCompletion(1, "done");
        vm.prank(admin);
        earnToPay.approveCompletion(user1, 1);

        vm.expectEmit(true, true, false, true);
        emit EarnToPay.RewardIssued(user1, 1, TEN_BOT, block.timestamp);

        vm.prank(admin);
        earnToPay.issueReward(user1, 1);
    }

    // =========================================================
    // SECURITY TESTS
    // =========================================================

    function test_UserCannotIssueTheirOwnReward() public {
        vm.prank(admin);
        earnToPay.createTask("Task", "d", "r", TEN_BOT);
        vm.prank(user1);
        earnToPay.submitCompletion(1, "done");

        vm.prank(user1);
        vm.expectRevert(EarnToPay.NotAdmin.selector);
        earnToPay.approveCompletion(user1, 1);
    }

    function test_UserCannotArbitrarilyIncreaseBalance() public {
        // No public function allows arbitrary balance increase for non-admin
        // This test verifies earnedBalance only changes through issueReward (admin function)
        assertEq(earnToPay.earnedBalance(user1), 0);

        // Only way to get balance is through admin-approved reward
        vm.prank(admin);
        earnToPay.createTask("Task", "d", "r", TEN_BOT);
        vm.prank(user1);
        earnToPay.submitCompletion(1, "done");

        // Still 0 - need admin approval
        assertEq(earnToPay.earnedBalance(user1), 0);

        vm.prank(admin);
        earnToPay.approveAndIssueReward(user1, 1);

        assertEq(earnToPay.earnedBalance(user1), TEN_BOT);
    }

    function test_WithdrawOnlyAdmin() public {
        vm.prank(unauthorized);
        vm.expectRevert(EarnToPay.NotAdmin.selector);
        earnToPay.withdrawUnallocated(ONE_BOT);
    }

    function test_WithdrawCannotExceedPool() public {
        uint256 pool = earnToPay.rewardPool();

        vm.prank(admin);
        vm.expectRevert(EarnToPay.InsufficientWithdrawable.selector);
        earnToPay.withdrawUnallocated(pool + 1);
    }

    function test_WithdrawReducesPool() public {
        uint256 poolBefore = earnToPay.rewardPool();

        vm.prank(admin);
        earnToPay.withdrawUnallocated(ONE_BOT);

        assertEq(earnToPay.rewardPool(), poolBefore - ONE_BOT);
    }

    function test_PlatformStats() public view {
        (
            uint256 tc,
            uint256 prc,
            uint256 rp,
            uint256 tri,
            uint256 tpv,
            uint256 cb
        ) = earnToPay.getPlatformStats();

        assertEq(tc, 0);
        assertEq(prc, 0);
        assertEq(rp, REWARD_POOL_INITIAL);
        assertEq(tri, 0);
        assertEq(tpv, 0);
        assertEq(cb, REWARD_POOL_INITIAL);
    }

    function test_BalanceOf() public {
        assertEq(earnToPay.balanceOf(user1), 0);

        vm.prank(admin);
        earnToPay.createTask("Task", "d", "r", TEN_BOT);
        vm.prank(user1);
        earnToPay.submitCompletion(1, "done");
        vm.prank(admin);
        earnToPay.approveAndIssueReward(user1, 1);

        assertEq(earnToPay.balanceOf(user1), TEN_BOT);
    }

    function test_GetPaymentRequests() public {
        vm.prank(merchant);
        earnToPay.createPaymentRequest(TEN_BOT, "PR1", "d", 0);
        vm.prank(merchant);
        earnToPay.createPaymentRequest(TWENTY_BOT, "PR2", "d", 0);

        EarnToPay.PaymentRequest[] memory prs = earnToPay.getPaymentRequests(1, 2);
        assertEq(prs.length, 2);
        assertEq(prs[0].title, "PR1");
        assertEq(prs[1].amount, TWENTY_BOT);
    }

    function test_AdminTransfer() public {
        vm.prank(admin);
        earnToPay.transferAdmin(user2);
        assertEq(earnToPay.admin(), user2);

        // Old admin cannot create task
        vm.prank(admin);
        vm.expectRevert(EarnToPay.NotAdmin.selector);
        earnToPay.createTask("Task", "d", "r", ONE_BOT);

        // New admin can
        vm.prank(user2);
        earnToPay.createTask("Task", "d", "r", ONE_BOT);
        assertEq(earnToPay.taskCount(), 1);
    }

    function test_ReceiveFundsAddsToPool() public {
        uint256 poolBefore = earnToPay.rewardPool();

        vm.prank(user1);
        (bool success, ) = address(earnToPay).call{value: ONE_BOT}("");
        assertTrue(success);
        assertEq(earnToPay.rewardPool(), poolBefore + ONE_BOT);
    }

    // =========================================================
    // USER WITHDRAWAL TESTS
    // =========================================================

    function test_UserCanWithdrawFullEarnedBalance() public {
        vm.prank(admin);
        earnToPay.createTask("Task", "d", "r", TEN_BOT);

        vm.prank(user1);
        earnToPay.submitCompletion(1, "proof");

        vm.prank(admin);
        earnToPay.approveAndIssueReward(user1, 1);

        assertEq(earnToPay.earnedBalance(user1), TEN_BOT);

        uint256 userWalletBefore = user1.balance;
        uint256 contractBalanceBefore = address(earnToPay).balance;

        vm.prank(user1);
        earnToPay.withdrawEarned(TEN_BOT);

        assertEq(earnToPay.earnedBalance(user1), 0);
        assertEq(earnToPay.totalWithdrawn(user1), TEN_BOT);
        assertEq(user1.balance, userWalletBefore + TEN_BOT);
        assertEq(address(earnToPay).balance, contractBalanceBefore - TEN_BOT);
    }

    function test_UserCanWithdrawPartialBalance() public {
        vm.prank(admin);
        earnToPay.createTask("Task", "d", "r", TEN_BOT);

        vm.prank(user1);
        earnToPay.submitCompletion(1, "proof");

        vm.prank(admin);
        earnToPay.approveAndIssueReward(user1, 1);

        uint256 userWalletBefore = user1.balance;

        // Withdraw 4 BOT out of 10 BOT
        vm.prank(user1);
        earnToPay.withdrawEarned(4 ether);

        assertEq(earnToPay.earnedBalance(user1), 6 ether);
        assertEq(earnToPay.totalWithdrawn(user1), 4 ether);
        assertEq(user1.balance, userWalletBefore + 4 ether);

        // Withdraw remaining 6 BOT
        vm.prank(user1);
        earnToPay.withdrawEarned(6 ether);

        assertEq(earnToPay.earnedBalance(user1), 0);
        assertEq(earnToPay.totalWithdrawn(user1), TEN_BOT);
        assertEq(user1.balance, userWalletBefore + TEN_BOT);
    }

    function test_CannotWithdrawZeroAmount() public {
        vm.prank(user1);
        vm.expectRevert(EarnToPay.InvalidAmount.selector);
        earnToPay.withdrawEarned(0);
    }

    function test_CannotWithdrawMoreThanEarnedBalance() public {
        vm.prank(admin);
        earnToPay.createTask("Task", "d", "r", TEN_BOT);

        vm.prank(user1);
        earnToPay.submitCompletion(1, "proof");

        vm.prank(admin);
        earnToPay.approveAndIssueReward(user1, 1);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(EarnToPay.InsufficientEarnedBalance.selector, 11 ether, 10 ether));
        earnToPay.withdrawEarned(11 ether);
    }

    function test_UserWithZeroBalanceCannotWithdraw() public {
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSelector(EarnToPay.InsufficientEarnedBalance.selector, ONE_BOT, 0));
        earnToPay.withdrawEarned(ONE_BOT);
    }

    function test_CannotDoubleWithdrawExceedingBalance() public {
        vm.prank(admin);
        earnToPay.createTask("Task", "d", "r", TEN_BOT);

        vm.prank(user1);
        earnToPay.submitCompletion(1, "proof");

        vm.prank(admin);
        earnToPay.approveAndIssueReward(user1, 1);

        // First withdraw 10 BOT
        vm.prank(user1);
        earnToPay.withdrawEarned(TEN_BOT);

        // Attempt second withdrawal of 1 BOT
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(EarnToPay.InsufficientEarnedBalance.selector, ONE_BOT, 0));
        earnToPay.withdrawEarned(ONE_BOT);
    }
}

