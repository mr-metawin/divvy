// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Divvy} from "../src/Divvy.sol";

contract DivvyHandler is Test {
    Divvy public immutable divvy;

    address[] public actors;
    uint256 public ghost_totalReceived;
    uint256 public ghost_totalReleased;

    struct SplitMeta {
        uint256 id;
        address[] members;
    }

    SplitMeta[] public splits;

    constructor(Divvy _divvy) {
        divvy = _divvy;
        actors.push(makeAddr("actor1"));
        actors.push(makeAddr("actor2"));
        actors.push(makeAddr("actor3"));
        actors.push(makeAddr("actor4"));

        for (uint256 i = 0; i < actors.length; i++) {
            vm.deal(actors[i], 1_000_000 ether);
        }
    }

    function createSplit(uint8 numMembersSeed, uint16 shareSeed) external {
        uint256 numMembers = bound(numMembersSeed, 2, 4);
        address[] memory members = new address[](numMembers);
        for (uint256 i = 0; i < numMembers; i++) {
            members[i] = actors[i];
        }

        uint16[] memory bps = new uint16[](numMembers);
        if (numMembers == 2) {
            uint16 s = uint16(bound(shareSeed, 1, 9999));
            bps[0] = s;
            bps[1] = 10_000 - s;
        } else if (numMembers == 3) {
            bps[0] = 3333;
            bps[1] = 3333;
            bps[2] = 3334;
        } else {
            bps[0] = 2500;
            bps[1] = 2500;
            bps[2] = 2500;
            bps[3] = 2500;
        }

        uint256 id = divvy.createSplit("InvSplit", members, bps);
        splits.push(SplitMeta({id: id, members: members}));
    }

    function pay(uint256 splitIndexSeed, uint96 amountSeed) external {
        if (splits.length == 0) return;
        uint256 splitIndex = splitIndexSeed % splits.length;
        uint256 id = splits[splitIndex].id;

        uint256 amount = bound(amountSeed, 1 wei, 100 ether);
        address payer = actors[0];

        vm.prank(payer);
        divvy.pay{value: amount}(id);
        ghost_totalReceived += amount;
    }

    function withdraw(uint256 splitIndexSeed, uint256 memberIndexSeed) external {
        if (splits.length == 0) return;
        uint256 splitIndex = splitIndexSeed % splits.length;
        SplitMeta storage meta = splits[splitIndex];
        address member = meta.members[memberIndexSeed % meta.members.length];

        uint256 claimableAmount = divvy.claimable(meta.id, member);
        if (claimableAmount == 0) return;

        vm.prank(member);
        divvy.withdraw(meta.id);
        ghost_totalReleased += claimableAmount;
    }

    function getSplitCount() external view returns (uint256) {
        return splits.length;
    }
}

contract DivvyInvariantTest is Test {
    Divvy public divvy;
    DivvyHandler public handler;

    function setUp() public {
        divvy = new Divvy();
        handler = new DivvyHandler(divvy);

        // Pre-create at least one split
        handler.createSplit(2, 5000);

        targetContract(address(handler));
    }

    function invariant_ContractBalanceEqualsTotalReceivedMinusReleased() public view {
        uint256 expectedBalance = handler.ghost_totalReceived() - handler.ghost_totalReleased();
        assertEq(
            address(divvy).balance,
            expectedBalance,
            "Contract balance must strictly equal totalReceived minus totalReleased"
        );
    }

    function invariant_SumAcrossAllSplits() public view {
        uint256 count = divvy.splitCount();
        uint256 sumReceived = 0;
        uint256 sumReleased = 0;

        for (uint256 id = 1; id <= count; id++) {
            Divvy.Split memory s = divvy.getSplit(id);
            sumReceived += s.totalReceived;

            (address[] memory members, ) = divvy.getMembers(id);
            for (uint256 j = 0; j < members.length; j++) {
                sumReleased += divvy.released(id, members[j]);
            }
        }

        assertEq(
            address(divvy).balance,
            sumReceived - sumReleased,
            "Balance must match sum(received) - sum(released) across all splits"
        );
    }
}
