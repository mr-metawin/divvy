// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Divvy} from "../src/Divvy.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MaliciousReentrantMember {
    Divvy public immutable divvy;
    uint256 public splitId;
    bool public attacked;
    bool public caughtReentrancyRevert;

    constructor(Divvy _divvy) {
        divvy = _divvy;
    }

    function setSplitId(uint256 _id) external {
        splitId = _id;
    }

    receive() external payable {
        if (!attacked) {
            attacked = true;
            // Attempt to re-enter withdraw
            try divvy.withdraw(splitId) {
                // If this succeeds, reentrancy guard failed
            } catch {
                caughtReentrancyRevert = true;
            }
        }
    }

    function triggerWithdraw() external {
        divvy.withdraw(splitId);
    }
}

contract DirectReenteringMember {
    Divvy public immutable divvy;
    uint256 public splitId;

    constructor(Divvy _divvy) {
        divvy = _divvy;
    }

    function setSplitId(uint256 _id) external {
        splitId = _id;
    }

    receive() external payable {
        // Direct call without try-catch -> causes TransferFailed on caller
        divvy.withdraw(splitId);
    }

    function triggerWithdraw() external {
        divvy.withdraw(splitId);
    }
}

contract RejectingMember {
    Divvy public immutable divvy;

    constructor(Divvy _divvy) {
        divvy = _divvy;
    }

    function triggerWithdraw(uint256 splitId) external {
        divvy.withdraw(splitId);
    }

    // Has no receive() or fallback(), so any ETH transfer to it will revert!
}

contract DivvyTest is Test {
    Divvy public divvy;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");
    address public dave = makeAddr("dave");
    address public payer = makeAddr("payer");

    event SplitCreated(uint256 indexed id, address indexed creator);
    event Paid(uint256 indexed id, address indexed payer, uint256 amount);
    event Withdrawn(uint256 indexed id, address indexed member, uint256 amount);

    function setUp() public {
        divvy = new Divvy();
        vm.deal(payer, 1000 ether);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(charlie, 100 ether);
    }

    /* -------------------------------------------------------------------------- */
    /*                              CREATESPLIT TESTS                             */
    /* -------------------------------------------------------------------------- */

    function test_CreateSplit_StoresCorrectData() public {
        address[] memory members = new address[](3);
        members[0] = alice;
        members[1] = bob;
        members[2] = charlie;

        uint16[] memory bps = new uint16[](3);
        bps[0] = 5000; // 50%
        bps[1] = 3000; // 30%
        bps[2] = 2000; // 20%

        vm.expectEmit(true, true, false, false);
        emit SplitCreated(1, address(this));

        uint256 id = divvy.createSplit("The Roommates", members, bps);
        assertEq(id, 1);
        assertEq(divvy.splitCount(), 1);

        Divvy.Split memory split = divvy.getSplit(1);
        assertEq(split.creator, address(this));
        assertEq(split.name, "The Roommates");
        assertEq(split.totalReceived, 0);
        assertEq(split.createdAt, block.timestamp);

        (address[] memory m, uint16[] memory b) = divvy.getMembers(1);
        assertEq(m.length, 3);
        assertEq(m[0], alice);
        assertEq(m[1], bob);
        assertEq(m[2], charlie);
        assertEq(b[0], 5000);
        assertEq(b[1], 3000);
        assertEq(b[2], 2000);

        uint256[] memory aliceSplits = divvy.getSplitIdsByMember(alice);
        assertEq(aliceSplits.length, 1);
        assertEq(aliceSplits[0], 1);

        uint256[] memory bobSplits = divvy.getSplitIdsByMember(bob);
        assertEq(bobSplits.length, 1);
        assertEq(bobSplits[0], 1);
    }

    function test_CreateSplit_RevertEmptyName() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;
        uint16[] memory bps = new uint16[](2);
        bps[0] = 5000;
        bps[1] = 5000;

        vm.expectRevert(Divvy.InvalidNameLength.selector);
        divvy.createSplit("", members, bps);
    }

    function test_CreateSplit_RevertOverLengthName() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;
        uint16[] memory bps = new uint16[](2);
        bps[0] = 5000;
        bps[1] = 5000;

        // 51 characters
        string memory longName = "123456789012345678901234567890123456789012345678901";
        vm.expectRevert(Divvy.InvalidNameLength.selector);
        divvy.createSplit(longName, members, bps);
    }

    function test_CreateSplit_RevertFewerThanTwoMembers() public {
        address[] memory members = new address[](1);
        members[0] = alice;
        uint16[] memory bps = new uint16[](1);
        bps[0] = 10000;

        vm.expectRevert(Divvy.InvalidMemberCount.selector);
        divvy.createSplit("Solo", members, bps);
    }

    function test_CreateSplit_RevertMoreThanTwentyMembers() public {
        address[] memory members = new address[](21);
        uint16[] memory bps = new uint16[](21);
        for (uint160 i = 0; i < 21; i++) {
            members[i] = address(i + 1);
            bps[i] = 100;
        }
        bps[20] = 8000 + 100; // sum to 10000

        vm.expectRevert(Divvy.InvalidMemberCount.selector);
        divvy.createSplit("Crowd", members, bps);
    }

    function test_CreateSplit_RevertMismatchedArrayLengths() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;
        uint16[] memory bps = new uint16[](3);
        bps[0] = 5000;
        bps[1] = 3000;
        bps[2] = 2000;

        vm.expectRevert(Divvy.ArrayLengthMismatch.selector);
        divvy.createSplit("Mismatch", members, bps);
    }

    function test_CreateSplit_RevertZeroAddressMember() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = address(0);
        uint16[] memory bps = new uint16[](2);
        bps[0] = 5000;
        bps[1] = 5000;

        vm.expectRevert(Divvy.ZeroAddress.selector);
        divvy.createSplit("NullMember", members, bps);
    }

    function test_CreateSplit_RevertDuplicateMembers() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = alice;
        uint16[] memory bps = new uint16[](2);
        bps[0] = 5000;
        bps[1] = 5000;

        vm.expectRevert(Divvy.DuplicateMember.selector);
        divvy.createSplit("Clone", members, bps);
    }

    function test_CreateSplit_RevertZeroBps() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;
        uint16[] memory bps = new uint16[](2);
        bps[0] = 10000;
        bps[1] = 0;

        vm.expectRevert(Divvy.InvalidBps.selector);
        divvy.createSplit("ZeroBps", members, bps);
    }

    function test_CreateSplit_RevertBpsNotSummingTo10000() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;

        // Sum = 9999
        uint16[] memory bpsUnder = new uint16[](2);
        bpsUnder[0] = 5000;
        bpsUnder[1] = 4999;
        vm.expectRevert(Divvy.TotalBpsNot10000.selector);
        divvy.createSplit("Under", members, bpsUnder);

        // Sum = 10001
        uint16[] memory bpsOver = new uint16[](2);
        bpsOver[0] = 5000;
        bpsOver[1] = 5001;
        vm.expectRevert(Divvy.TotalBpsNot10000.selector);
        divvy.createSplit("Over", members, bpsOver);
    }

    /* -------------------------------------------------------------------------- */
    /*                                  PAY TESTS                                 */
    /* -------------------------------------------------------------------------- */

    function test_Pay_IncreasesTotalReceivedAndEmitsEvent() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;
        uint16[] memory bps = new uint16[](2);
        bps[0] = 6000;
        bps[1] = 4000;
        uint256 id = divvy.createSplit("Band", members, bps);

        vm.expectEmit(true, true, false, true);
        emit Paid(id, payer, 5 ether);

        vm.prank(payer);
        divvy.pay{value: 5 ether}(id);

        Divvy.Split memory split = divvy.getSplit(id);
        assertEq(split.totalReceived, 5 ether);
        assertEq(address(divvy).balance, 5 ether);
        assertEq(divvy.claimable(id, alice), 3 ether); // 60% of 5 ether
        assertEq(divvy.claimable(id, bob), 2 ether);   // 40% of 5 ether
    }

    function test_Pay_RevertsOnZeroValue() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;
        uint16[] memory bps = new uint16[](2);
        bps[0] = 5000;
        bps[1] = 5000;
        uint256 id = divvy.createSplit("Band", members, bps);

        vm.prank(payer);
        vm.expectRevert(Divvy.ZeroPayment.selector);
        divvy.pay{value: 0}(id);
    }

    function test_Pay_RevertsOnNonexistentSplit() public {
        vm.prank(payer);
        vm.expectRevert(Divvy.SplitDoesNotExist.selector);
        divvy.pay{value: 1 ether}(999);

        vm.prank(payer);
        vm.expectRevert(Divvy.SplitDoesNotExist.selector);
        divvy.pay{value: 1 ether}(0);
    }

    /* -------------------------------------------------------------------------- */
    /*                               WITHDRAW TESTS                               */
    /* -------------------------------------------------------------------------- */

    function test_Withdraw_PaysRightAmountToEachMember() public {
        address[] memory members = new address[](3);
        members[0] = alice;
        members[1] = bob;
        members[2] = charlie;
        uint16[] memory bps = new uint16[](3);
        bps[0] = 5000;
        bps[1] = 3000;
        bps[2] = 2000;
        uint256 id = divvy.createSplit("Trio", members, bps);

        vm.prank(payer);
        divvy.pay{value: 10 ether}(id);

        uint256 aliceBalBefore = alice.balance;
        vm.expectEmit(true, true, false, true);
        emit Withdrawn(id, alice, 5 ether);
        vm.prank(alice);
        divvy.withdraw(id);
        assertEq(alice.balance - aliceBalBefore, 5 ether);
        assertEq(divvy.released(id, alice), 5 ether);
        assertEq(divvy.claimable(id, alice), 0);

        uint256 bobBalBefore = bob.balance;
        vm.prank(bob);
        divvy.withdraw(id);
        assertEq(bob.balance - bobBalBefore, 3 ether);
        assertEq(divvy.released(id, bob), 3 ether);

        uint256 charlieBalBefore = charlie.balance;
        vm.prank(charlie);
        divvy.withdraw(id);
        assertEq(charlie.balance - charlieBalBefore, 2 ether);
        assertEq(divvy.released(id, charlie), 2 ether);

        assertEq(address(divvy).balance, 0);
    }

    function test_Withdraw_WorksAfterSeveralSeparatePayments() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;
        uint16[] memory bps = new uint16[](2);
        bps[0] = 5000;
        bps[1] = 5000;
        uint256 id = divvy.createSplit("Duo", members, bps);

        // Payment 1: 2 ether
        vm.prank(payer);
        divvy.pay{value: 2 ether}(id);

        // Payment 2: 3 ether
        vm.prank(payer);
        divvy.pay{value: 3 ether}(id);

        // Payment 3: 5 ether
        vm.prank(payer);
        divvy.pay{value: 5 ether}(id);

        uint256 aliceBalBefore = alice.balance;
        vm.prank(alice);
        divvy.withdraw(id);
        assertEq(alice.balance - aliceBalBefore, 5 ether); // 50% of 10 ether
    }

    function test_Withdraw_EarlyAndAgainAfterNewPayments() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;
        uint16[] memory bps = new uint16[](2);
        bps[0] = 6000; // 60%
        bps[1] = 4000; // 40%
        uint256 id = divvy.createSplit("Duo", members, bps);

        // Payment 1: 10 ether
        vm.prank(payer);
        divvy.pay{value: 10 ether}(id);

        // Alice withdraws first round (6 ether)
        uint256 aliceBalBefore = alice.balance;
        vm.prank(alice);
        divvy.withdraw(id);
        assertEq(alice.balance - aliceBalBefore, 6 ether);
        assertEq(divvy.released(id, alice), 6 ether);

        // Payment 2: 20 ether
        vm.prank(payer);
        divvy.pay{value: 20 ether}(id);

        // Total received is now 30 ether. Alice's 60% total is 18 ether.
        // Since 6 ether was released, she gets 12 ether.
        uint256 aliceBalBefore2 = alice.balance;
        vm.prank(alice);
        divvy.withdraw(id);
        assertEq(alice.balance - aliceBalBefore2, 12 ether);
        assertEq(divvy.released(id, alice), 18 ether);

        // Bob withdraws all at once: 40% of 30 ether = 12 ether
        uint256 bobBalBefore = bob.balance;
        vm.prank(bob);
        divvy.withdraw(id);
        assertEq(bob.balance - bobBalBefore, 12 ether);
        assertEq(divvy.released(id, bob), 12 ether);

        assertEq(address(divvy).balance, 0);
    }

    function test_Withdraw_AwkwardAmountsAndDustIntegrity() public {
        address[] memory members = new address[](3);
        members[0] = alice;
        members[1] = bob;
        members[2] = charlie;
        uint16[] memory bps = new uint16[](3);
        bps[0] = 3333; // 33.33%
        bps[1] = 3333; // 33.33%
        bps[2] = 3334; // 33.34%
        uint256 id = divvy.createSplit("Awkward", members, bps);

        uint256[] memory awkwardPayments = new uint256[](3);
        awkwardPayments[0] = 1 wei;
        awkwardPayments[1] = 7 wei;
        awkwardPayments[2] = 1000000007 wei;

        for (uint256 i = 0; i < awkwardPayments.length; i++) {
            vm.prank(payer);
            divvy.pay{value: awkwardPayments[i]}(id);
        }

        uint256 totalReceived = 1 wei + 7 wei + 1000000007 wei;
        assertEq(divvy.getSplit(id).totalReceived, totalReceived);

        // Members withdraw
        vm.prank(alice);
        divvy.withdraw(id);

        vm.prank(bob);
        divvy.withdraw(id);

        vm.prank(charlie);
        divvy.withdraw(id);

        uint256 totalWithdrawn = divvy.released(id, alice) + divvy.released(id, bob) + divvy.released(id, charlie);

        // Total paid out must NEVER exceed totalReceived
        assertLe(totalWithdrawn, totalReceived);

        // Dust left behind in contract must be less than member count (3)
        uint256 dust = totalReceived - totalWithdrawn;
        assertLt(dust, members.length);
        assertEq(address(divvy).balance, dust);
    }

    function test_Withdraw_RevertsForNonMember() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;
        uint16[] memory bps = new uint16[](2);
        bps[0] = 5000;
        bps[1] = 5000;
        uint256 id = divvy.createSplit("Duo", members, bps);

        vm.prank(payer);
        divvy.pay{value: 2 ether}(id);

        vm.prank(dave);
        vm.expectRevert(Divvy.NotAMember.selector);
        divvy.withdraw(id);
    }

    function test_Withdraw_RevertsWhenNothingOwed() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;
        uint16[] memory bps = new uint16[](2);
        bps[0] = 5000;
        bps[1] = 5000;
        uint256 id = divvy.createSplit("Duo", members, bps);

        // No payments yet
        vm.prank(alice);
        vm.expectRevert(Divvy.NothingOwed.selector);
        divvy.withdraw(id);
    }

    function test_Withdraw_SecondWithdrawWithNoNewPaymentsReverts() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;
        uint16[] memory bps = new uint16[](2);
        bps[0] = 5000;
        bps[1] = 5000;
        uint256 id = divvy.createSplit("Duo", members, bps);

        vm.prank(payer);
        divvy.pay{value: 2 ether}(id);

        vm.prank(alice);
        divvy.withdraw(id);

        // Second withdraw without new payments
        vm.prank(alice);
        vm.expectRevert(Divvy.NothingOwed.selector);
        divvy.withdraw(id);
    }

    function test_Withdraw_ReentrancyBlocked() public {
        MaliciousReentrantMember attacker = new MaliciousReentrantMember(divvy);

        address[] memory members = new address[](2);
        members[0] = address(attacker);
        members[1] = bob;
        uint16[] memory bps = new uint16[](2);
        bps[0] = 5000;
        bps[1] = 5000;
        uint256 id = divvy.createSplit("AttackTarget", members, bps);
        attacker.setSplitId(id);

        vm.prank(payer);
        divvy.pay{value: 4 ether}(id);

        // Attacker triggers withdraw. Reentrancy inside receive() should catch reentrancy error
        attacker.triggerWithdraw();
        assertTrue(attacker.caughtReentrancyRevert());
        assertEq(divvy.released(id, address(attacker)), 2 ether);
        assertEq(address(attacker).balance, 2 ether);

        // Direct reentrant attacker without catch reverts completely
        DirectReenteringMember directAttacker = new DirectReenteringMember(divvy);
        members[0] = address(directAttacker);
        uint256 id2 = divvy.createSplit("DirectAttack", members, bps);
        directAttacker.setSplitId(id2);

        vm.prank(payer);
        divvy.pay{value: 4 ether}(id2);

        vm.expectRevert(Divvy.TransferFailed.selector);
        directAttacker.triggerWithdraw();
    }

    function test_Withdraw_RejectingMemberDoesNotBlockOthers() public {
        RejectingMember rejecter = new RejectingMember(divvy);

        address[] memory members = new address[](2);
        members[0] = address(rejecter);
        members[1] = bob;
        uint16[] memory bps = new uint16[](2);
        bps[0] = 5000;
        bps[1] = 5000;
        uint256 id = divvy.createSplit("RejectTest", members, bps);

        vm.prank(payer);
        divvy.pay{value: 4 ether}(id);

        // Rejecter fails to withdraw because it rejects native BOT
        vm.expectRevert(Divvy.TransferFailed.selector);
        rejecter.triggerWithdraw(id);

        // Bob can withdraw without issue!
        uint256 bobBalBefore = bob.balance;
        vm.prank(bob);
        divvy.withdraw(id);
        assertEq(bob.balance - bobBalBefore, 2 ether);
        assertEq(divvy.released(id, bob), 2 ether);
    }

    function test_DirectEtherTransferReverts() public {
        (bool ok, ) = address(divvy).call{value: 1 ether}("");
        assertFalse(ok);
    }

    /* -------------------------------------------------------------------------- */
    /*                                  FUZZ TEST                                 */
    /* -------------------------------------------------------------------------- */

    function testFuzz_SplitIntegrity(
        uint16 share1,
        uint16 share2,
        uint96 pay1,
        uint96 pay2,
        bool withdrawOrder
    ) public {
        // Bound shares so share1 in [1, 9999] and share1 + share2 = 10_000
        share1 = uint16(bound(share1, 1, 9999));
        share2 = 10_000 - share1;

        // Bound payments to non-zero values up to 500 ether
        pay1 = uint96(bound(pay1, 1 wei, 500 ether));
        pay2 = uint96(bound(pay2, 1 wei, 500 ether));

        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;
        uint16[] memory bps = new uint16[](2);
        bps[0] = share1;
        bps[1] = share2;

        uint256 id = divvy.createSplit("FuzzSplit", members, bps);

        // First payment
        vm.prank(payer);
        divvy.pay{value: pay1}(id);

        // Withdraw order variation
        if (withdrawOrder) {
            if (divvy.claimable(id, alice) > 0) {
                vm.prank(alice);
                divvy.withdraw(id);
            }
        } else {
            if (divvy.claimable(id, bob) > 0) {
                vm.prank(bob);
                divvy.withdraw(id);
            }
        }

        // Second payment
        vm.prank(payer);
        divvy.pay{value: pay2}(id);

        // Remaining withdraws
        if (divvy.claimable(id, alice) > 0) {
            vm.prank(alice);
            divvy.withdraw(id);
        }

        if (divvy.claimable(id, bob) > 0) {
            vm.prank(bob);
            divvy.withdraw(id);
        }

        uint256 totalReceived = uint256(pay1) + uint256(pay2);
        uint256 totalWithdrawn = divvy.released(id, alice) + divvy.released(id, bob);

        // Never creates or destroys BOT: totalWithdrawn <= totalReceived
        assertLe(totalWithdrawn, totalReceived);

        // Dust must be strictly less than member count (2)
        uint256 dust = totalReceived - totalWithdrawn;
        assertLt(dust, 2);

        // Contract balance must match dust exactly
        assertEq(address(divvy).balance, dust);
    }
}
