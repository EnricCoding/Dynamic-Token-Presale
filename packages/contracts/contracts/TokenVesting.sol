// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title TokenVesting - Professional linear vesting contract for Dynamic Presale
/// @notice Allows beneficiaries to release vested tokens according to schedule with cliff period
/// @dev Supports multiple schedules per beneficiary, revocable vesting, and emergency functions
contract TokenVesting is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    struct VestingSchedule {
        uint256 totalAmount; // total tokens allocated to schedule
        uint256 released; // tokens already released
        uint256 start; // start timestamp
        uint256 duration; // total duration in seconds
        uint256 cliff; // cliff in seconds from start
        bool revocable; // can owner revoke?
        bool revoked; // already revoked?
    }

    IERC20 public immutable token;

    uint256 public totalVestingSchedules;
    uint256 public totalCommitted; 
    mapping(address => VestingSchedule[]) private schedules;
    mapping(address => uint256) public totalVestedAmount; 

    event VestingCreated(
        address indexed beneficiary,
        uint256 indexed scheduleId,
        uint256 totalAmount,
        uint256 start,
        uint256 duration,
        uint256 cliff,
        bool revocable
    );
    event TokensReleased(
        address indexed beneficiary,
        uint256 indexed scheduleId,
        uint256 amount
    );
    event VestingRevoked(
        address indexed beneficiary,
        uint256 indexed scheduleId,
        uint256 unvestedAmount
    );

    /// @notice Constructor
    /// @param token_ ERC20 token used for vesting
    constructor(address token_) Ownable(msg.sender) {
        require(token_ != address(0), "Vesting: token address zero");
        token = IERC20(token_);
    }

    // -------------------------
    // Create / Manage vesting
    // -------------------------

    /// @notice Create vesting schedule for beneficiary. Only owner.
    /// @param beneficiary Address of the beneficiary
    /// @param totalAmount Total amount of tokens to vest (in token units)
    /// @param start Start timestamp of vesting (>= now)
    /// @param duration Duration of vesting in seconds (> 0)
    /// @param cliff Cliff period in seconds (<= duration)
    /// @param revocable Whether the vesting can be revoked by owner
    function createVesting(
        address beneficiary,
        uint256 totalAmount,
        uint256 start,
        uint256 duration,
        uint256 cliff,
        bool revocable
    ) external onlyOwner whenNotPaused {
        require(beneficiary != address(0), "Vesting: beneficiary zero");
        require(totalAmount > 0, "Vesting: zero amount");
        require(duration > 0, "Vesting: zero duration");
        require(cliff <= duration, "Vesting: cliff greater than duration");
        require(start >= block.timestamp, "Vesting: start time in past");

        require(
            token.balanceOf(address(this)) >= totalCommitted + totalAmount,
            "Vesting: insufficient token balance for new vesting"
        );

        schedules[beneficiary].push(
            VestingSchedule({
                totalAmount: totalAmount,
                released: 0,
                start: start,
                duration: duration,
                cliff: cliff,
                revocable: revocable,
                revoked: false
            })
        );

        totalVestedAmount[beneficiary] += totalAmount;
        totalCommitted += totalAmount;
        totalVestingSchedules++;

        uint256 scheduleId = schedules[beneficiary].length - 1;
        emit VestingCreated(
            beneficiary,
            scheduleId,
            totalAmount,
            start,
            duration,
            cliff,
            revocable
        );
    }

    // -------------------------
    // Release functions
    // -------------------------

    /// @notice Release vested tokens for all schedules of the caller
    function release() external nonReentrant whenNotPaused {
        uint256 totalReleasable = 0;
        VestingSchedule[] storage userSchedules = schedules[msg.sender];

        for (uint256 i = 0; i < userSchedules.length; i++) {
            VestingSchedule storage schedule = userSchedules[i];
            if (schedule.revoked) continue;

            uint256 vested = _vestedAmount(schedule);
            uint256 unreleased = 0;
            if (vested > schedule.released) {
                unreleased = vested - schedule.released;
            } else {
                continue;
            }

            schedule.released += unreleased;
            totalReleasable += unreleased;

            if (totalCommitted >= unreleased) {
                totalCommitted -= unreleased;
            } else {
                totalCommitted = 0;
            }

            if (totalVestedAmount[msg.sender] >= unreleased) {
                totalVestedAmount[msg.sender] -= unreleased;
            } else {
                totalVestedAmount[msg.sender] = 0;
            }

            emit TokensReleased(msg.sender, i, unreleased);
        }

        require(totalReleasable > 0, "Vesting: nothing to release");
        token.safeTransfer(msg.sender, totalReleasable);
    }

    /// @notice Release vested tokens for a specific schedule
    /// @param scheduleId Index of the schedule to release
    function releaseSchedule(
        uint256 scheduleId
    ) external nonReentrant whenNotPaused {
        VestingSchedule[] storage userSchedules = schedules[msg.sender];
        require(
            scheduleId < userSchedules.length,
            "Vesting: invalid schedule ID"
        );

        VestingSchedule storage schedule = userSchedules[scheduleId];
        require(!schedule.revoked, "Vesting: schedule revoked");

        uint256 vested = _vestedAmount(schedule);
        require(vested > schedule.released, "Vesting: nothing to release");
        uint256 unreleased = vested - schedule.released;

        schedule.released += unreleased;

        if (totalCommitted >= unreleased) {
            totalCommitted -= unreleased;
        } else {
            totalCommitted = 0;
        }

        if (totalVestedAmount[msg.sender] >= unreleased) {
            totalVestedAmount[msg.sender] -= unreleased;
        } else {
            totalVestedAmount[msg.sender] = 0;
        }

        token.safeTransfer(msg.sender, unreleased);
        emit TokensReleased(msg.sender, scheduleId, unreleased);
    }

    // -------------------------
    // Vesting math
    // -------------------------

    /// @notice Calculate vested amount for a schedule with cliff support
    function _vestedAmount(
        VestingSchedule memory schedule
    ) internal view returns (uint256) {
        if (block.timestamp < schedule.start + schedule.cliff) {
            return 0;
        } else if (block.timestamp >= schedule.start + schedule.duration) {
            return schedule.totalAmount;
        } else {
            uint256 elapsed = block.timestamp - schedule.start;
            uint256 part1 = schedule.totalAmount / schedule.duration;
            uint256 part2 = schedule.totalAmount % schedule.duration;
            return part1 * elapsed + (part2 * elapsed) / schedule.duration;
        }
    }

    // -------------------------
    // Revocation
    // -------------------------

    /// @notice Revoke vesting schedule. Only owner and only if revocable.
    /// @param beneficiary Address of beneficiary
    /// @param scheduleId Index of schedule to revoke
    function revokeVesting(
        address beneficiary,
        uint256 scheduleId
    ) external onlyOwner {
        VestingSchedule[] storage userSchedules = schedules[beneficiary];
        require(
            scheduleId < userSchedules.length,
            "Vesting: invalid schedule ID"
        );

        VestingSchedule storage schedule = userSchedules[scheduleId];
        require(schedule.revocable, "Vesting: not revocable");
        require(!schedule.revoked, "Vesting: already revoked");

        uint256 vested = _vestedAmount(schedule);
        uint256 unvested = 0;
        if (schedule.totalAmount > vested) {
            unvested = schedule.totalAmount - vested;
        } 

        schedule.revoked = true;

        if (totalCommitted >= unvested) {
            totalCommitted -= unvested;
        } else {
            totalCommitted = 0;
        }

        if (totalVestedAmount[beneficiary] >= unvested) {
            totalVestedAmount[beneficiary] -= unvested;
        } else {
            totalVestedAmount[beneficiary] = 0;
        }

        if (unvested > 0) {
            token.safeTransfer(owner(), unvested);
        }

        emit VestingRevoked(beneficiary, scheduleId, unvested);
    }

    // -------------------------
    // Admin utilities
    // -------------------------

    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(
            amount <= token.balanceOf(address(this)),
            "Vesting: insufficient balance"
        );
        token.safeTransfer(owner(), amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // -------------------------
    // Views / helpers
    // -------------------------

    /// @notice Get number of schedules for a beneficiary
    /// @param beneficiary Address to check
    function getScheduleCount(
        address beneficiary
    ) external view returns (uint256) {
        return schedules[beneficiary].length;
    }

    /// @notice Get vested amount for a specific schedule
    /// @param beneficiary Address of beneficiary
    /// @param scheduleId Index of schedule
    function getVestedAmount(
        address beneficiary,
        uint256 scheduleId
    ) external view returns (uint256) {
        require(
            scheduleId < schedules[beneficiary].length,
            "Vesting: invalid schedule ID"
        );
        return _vestedAmount(schedules[beneficiary][scheduleId]);
    }

    /// @notice Get releasable amount for a specific schedule
    /// @param beneficiary Address of beneficiary
    /// @param scheduleId Index of schedule
    function getReleasableAmount(
        address beneficiary,
        uint256 scheduleId
    ) external view returns (uint256) {
        require(
            scheduleId < schedules[beneficiary].length,
            "Vesting: invalid schedule ID"
        );
        VestingSchedule memory schedule = schedules[beneficiary][scheduleId];
        if (schedule.revoked) return 0;
        uint256 vested = _vestedAmount(schedule);
        return (vested > schedule.released) ? (vested - schedule.released) : 0;
    }

    /// @notice Get total releasable amount for all schedules of a beneficiary
    /// @param beneficiary Address to check
    function getTotalReleasableAmount(
        address beneficiary
    ) external view returns (uint256) {
        uint256 totalReleasable = 0;
        VestingSchedule[] memory userSchedules = schedules[beneficiary];

        for (uint256 i = 0; i < userSchedules.length; i++) {
            if (userSchedules[i].revoked) continue;
            uint256 vested = _vestedAmount(userSchedules[i]);
            uint256 unreleased = (vested > userSchedules[i].released)
                ? (vested - userSchedules[i].released)
                : 0;
            totalReleasable += unreleased;
        }

        return totalReleasable;
    }

    /// @notice Get schedule details
    /// @param beneficiary Address of beneficiary
    /// @param scheduleId Index of schedule
    function getSchedule(
        address beneficiary,
        uint256 scheduleId
    ) external view returns (VestingSchedule memory) {
        require(
            scheduleId < schedules[beneficiary].length,
            "Vesting: invalid schedule ID"
        );
        return schedules[beneficiary][scheduleId];
    }

    /// @notice Get total committed tokens across all vesting schedules (not yet distributed)
    function getTotalCommitted() external view returns (uint256) {
        return totalCommitted;
    }
}
