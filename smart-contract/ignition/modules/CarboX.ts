import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CarboXModule", (m) => {
  // Bước 1: Deploy hai hợp đồng quản lý tài sản trước
  const carbonCredit = m.contract("CarbonCredit1155");
  const greenCert = m.contract("GreenCertificateNFT");

  // Bước 2: Deploy Marketplace, truyền địa chỉ của 2 hợp đồng trên vào constructor
  const marketplace = m.contract("CarbonMarketplace", [carbonCredit, greenCert]);

  // Bước 3: Gọi hàm setMarketplace để cấp quyền phân phối cho Marketplace
  m.call(carbonCredit, "setMarketplace", [marketplace]);
  m.call(greenCert, "setMarketplace", [marketplace]);

  // Trả về các instance để Hardhat ghi nhận
  return { carbonCredit, greenCert, marketplace };
});