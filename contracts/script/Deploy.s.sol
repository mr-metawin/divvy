// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Divvy} from "../src/Divvy.sol";

contract DeployScript is Script {
    function run() external returns (Divvy divvy) {
        vm.startBroadcast();
        divvy = new Divvy();
        vm.stopBroadcast();

        console.log("Divvy deployed at:", address(divvy));
    }
}
