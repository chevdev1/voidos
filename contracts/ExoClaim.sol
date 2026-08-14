// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// Claim lots by pulling EXO from the caller and sending it to the burn sink.
/// Deploy on Robinhood Chain, then set VITE_EXO_TOKEN + VITE_CLAIM_CONTRACT (and server EXO_TOKEN / CLAIM_CONTRACT).
contract ExoClaim {
    address public immutable exoToken;
    address public owner;
    address public constant BURN_SINK = 0x000000000000000000000000000000000000dEaD;

    uint256 public defaultPrice;
    mapping(bytes32 => uint256) public lotPrice;
    mapping(bytes32 => address) public claimedBy;

    event Claimed(address indexed user, bytes32[] lotIds, uint256 exoPaid);

    constructor(address token, uint256 defaultPriceWei) {
        require(token != address(0), "token");
        exoToken = token;
        owner = msg.sender;
        defaultPrice = defaultPriceWei;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "owner");
        _;
    }

    function setOwner(address next) external onlyOwner {
        require(next != address(0), "owner");
        owner = next;
    }

    function setDefaultPrice(uint256 priceWei) external onlyOwner {
        defaultPrice = priceWei;
    }

    function setLotPrice(bytes32 lotId, uint256 priceWei) external onlyOwner {
        lotPrice[lotId] = priceWei;
    }

    function quote(bytes32[] calldata lotIds) public view returns (uint256 cost) {
        for (uint256 i = 0; i < lotIds.length; i++) {
            uint256 p = lotPrice[lotIds[i]];
            cost += p == 0 ? defaultPrice : p;
        }
    }

    function claim(bytes32[] calldata lotIds) external {
        require(lotIds.length > 0, "lots");
        for (uint256 i = 0; i < lotIds.length; i++) {
            require(claimedBy[lotIds[i]] == address(0), "taken");
            claimedBy[lotIds[i]] = msg.sender;
        }
        uint256 cost = quote(lotIds);
        require(cost > 0, "price");
        require(IERC20(exoToken).transferFrom(msg.sender, BURN_SINK, cost), "pay");
        emit Claimed(msg.sender, lotIds, cost);
    }
}
