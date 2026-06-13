import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("Counter Contract", function () {
  it("should have initial value of 0", async function () {
    const counter = await ethers.deployContract("Counter");
    await counter.waitForDeployment();

    expect(await counter.x()).to.equal(0n);
  });

  it("should increment x by 1", async function () {
    const counter = await ethers.deployContract("Counter");
    await counter.waitForDeployment();

    await counter.inc();
    expect(await counter.x()).to.equal(1n);
  });

  it("should increment x by specified amount", async function () {
    const counter = await ethers.deployContract("Counter");
    await counter.waitForDeployment();

    await counter.incBy(5n);
    expect(await counter.x()).to.equal(5n);
  });

  it("should revert when incBy(0)", async function () {
    const counter = await ethers.deployContract("Counter");
    await counter.waitForDeployment();

    await expect(counter.incBy(0n)).to.be.revertedWith(
      "incBy: increment should be positive"
    );
  });

  it("should emit Increment event", async function () {
    const counter = await ethers.deployContract("Counter");
    await counter.waitForDeployment();

    await expect(counter.inc())
      .to.emit(counter, "Increment")
      .withArgs(1n);
  });
});
