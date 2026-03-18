import { ethers } from "hardhat";

async function main() {
  const EidolonToken = await ethers.getContractFactory("EidolonToken");
  const token = await EidolonToken.deploy();

  await token.deployed();

  console.log(`EidolonToken deployed to: ${token.address}`);
  console.log(`Transaction hash: ${token.deployTransaction.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
