// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/EarnToPay.sol";

contract DeployEarnToPay is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=================================================");
        console.log("EarnToPay Deployment");
        console.log("=================================================");
        console.log("Network:    Bohr Testnet");
        console.log("Chain ID:   968");
        console.log("RPC:        https://rpc.bohr.life");
        console.log("Explorer:   https://scan.bohr.life/");
        console.log("Deployer:   ", deployer);
        console.log("Balance:    ", deployer.balance / 1e18, "BOT");
        console.log("=================================================");

        vm.startBroadcast(deployerPrivateKey);

        EarnToPay earnToPay = new EarnToPay();

        vm.stopBroadcast();

        console.log("=================================================");
        console.log("Deployment Successful!");
        console.log("=================================================");
        console.log("Contract:   EarnToPay");
        console.log("Address:    ", address(earnToPay));
        console.log("Admin:      ", earnToPay.admin());
        console.log("Explorer:   https://scan.bohr.life/address/", address(earnToPay));
        console.log("=================================================");
        console.log("Next steps:");
        console.log("1. Fund reward pool via fundRewardPool()");
        console.log("2. Update frontend VITE_EARN_TO_PAY_CONTRACT_ADDRESS");
        console.log("3. Verify contract on Bohr Scan");
        console.log("=================================================");
    }
}
