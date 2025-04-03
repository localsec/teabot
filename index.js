import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";
import chalk from "chalk";
import figlet from "figlet";
import solc from "solc";
import path from "path";
import { exit } from "process";
dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
// Tải danh sách private keys từ file hoặc biến môi trường
const privateKeys = process.env.PRIVATE_KEYS ? process.env.PRIVATE_KEYS.split(",") : fs.readFileSync("wallets.txt", "utf-8").split("\n").map(key => key.trim()).filter(key => key);
const wallets = privateKeys.map(key => new ethers.Wallet(key.trim(), provider));

let savedOption = null;
let savedTransactionCount = null;

// Hàm hiển thị banner ASCII
function showBanner() {
    console.clear();
    console.log(chalk.blueBright(figlet.textSync("LocalSec", { horizontalLayout: "fitted" })));
    console.log(chalk.greenBright("🔥 Được tạo bởi NT - Exhaust, Phát triển bởi: LocalSec 🔥"));
    console.log(chalk.greenBright("🔥 LocalSec 🔥\n"));
}

// Hàm hiển thị thông tin tất cả các ví
async function showWalletInfo() {
    console.log(chalk.yellow("💳 Thông tin các ví"));
    for (let i = 0; i < wallets.length; i++) {
        const balance = await provider.getBalance(wallets[i].address);
        console.log(chalk.cyan(`🔹 Ví ${i + 1} - Địa chỉ: ${wallets[i].address}`));
        console.log(chalk.green(`🔹 Số dư: ${ethers.formatEther(balance)} ETH`));
    }
    console.log("");
}

// Hàm biên dịch và triển khai hợp đồng từ nhiều ví
async function deployContract() {
    const contractPath = path.resolve("auto.sol");

    if (!fs.existsSync(contractPath)) {
        console.log(chalk.red(`❌ Tệp ${contractPath} không được tìm thấy.`));
        return;
    }

    const contractSource = fs.readFileSync(contractPath, "utf8");

    function findImports(importPath) {
        const fullPath = path.resolve("node_modules", importPath);
        if (fs.existsSync(fullPath)) {
            return { contents: fs.readFileSync(fullPath, "utf8") };
        } else {
            return { error: "Tệp không được tìm thấy" };
        }
    }

    const input = {
        language: "Solidity",
        sources: {
            "auto.sol": { content: contractSource }
        },
        settings: {
            outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } }
        }
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

    const contractName = Object.keys(output.contracts["auto.sol"])[0];
    const contractData = output.contracts["auto.sol"][contractName];

    if (!contractData.evm.bytecode.object) {
        console.log(chalk.red(`❌ Biên dịch thất bại! Kiểm tra mã Solidity.`));
        return;
    }

    console.log(chalk.yellow("⏳ Đang triển khai hợp đồng từ nhiều ví..."));

    for (let i = 0; i < wallets.length; i++) {
        const wallet = wallets[i];
        const contractFactory = new ethers.ContractFactory(contractData.abi, contractData.evm.bytecode.object, wallet);

        console.log(chalk.cyan(`🔹 Triển khai từ ví ${i + 1}: ${wallet.address}`));
        try {
            const contract = await contractFactory.deploy("MyToken", "MTK", 1000000, wallet.address);
            await contract.waitForDeployment();

            console.log(chalk.green(`✅ Hợp đồng đã được triển khai! Địa chỉ: ${chalk.blue(await contract.getAddress())}`));
        } catch (error) {
            console.log(chalk.red(`❌ Triển khai từ ví ${wallet.address} thất bại: ${error.message}`));
        }

        // Đợi 5 giây trước khi triển khai từ ví tiếp theo để tránh quá tải mạng
        if (i < wallets.length - 1) {
            console.log(chalk.gray("⌛ Đợi 5 giây trước khi triển khai từ ví tiếp theo...\n"));
            await new Promise(res => setTimeout(res, 5000));
        }
    }

    console.log(chalk.greenBright("\n🎉 Hoàn tất triển khai từ tất cả các ví!\n"));
    process.exit(0);
}

// Hàm xử lý các giao dịch tự động với nhiều ví
async function autoTransaction() {
    let option = savedOption;
    let transactionCount = savedTransactionCount;

    if (option === null || transactionCount === null) {
        option = await askQuestion(chalk.magenta("\nChọn tùy chọn giao dịch (1: Địa chỉ đốt, 2: Ví KYC): "));
        transactionCount = await askQuestion(chalk.magenta("Nhập số lượng giao dịch: "));

        savedOption = option;
        savedTransactionCount = Number(transactionCount);
    }

    const file = option === "1" ? "burnAddress.txt" : "KycAddress.txt";

    if (!fs.existsSync(file)) {
        console.log(chalk.red(`❌ Tệp ${file} không được tìm thấy.`));
        return;
    }

    const addresses = fs.readFileSync(file, "utf-8").split("\n").map(addr => addr.trim()).filter(addr => addr);

    console.log(chalk.yellow("\n🚀 Bắt đầu giao dịch...\n"));

    for (let i = 0; i < savedTransactionCount; i++) {
        const wallet = wallets[Math.floor(Math.random() * wallets.length)]; // Chọn ngẫu nhiên một ví
        const recipient = addresses[Math.floor(Math.random() * addresses.length)];
        const amount = (Math.random() * (0.09 - 0.01) + 0.01).toFixed(4);

        console.log(chalk.blueBright(`🔹 Giao dịch ${i + 1}/${savedTransactionCount} từ ví ${wallet.address}`));
        console.log(chalk.cyan(`➡ Gửi ${chalk.green(amount + " ETH")} đến ${chalk.yellow(recipient)}`));

        try {
            const tx = await wallet.sendTransaction({
                to: recipient,
                value: ethers.parseEther(amount)
            });

            console.log(chalk.green(`✅ Thành công! Mã giao dịch: ${chalk.blue(tx.hash)}`));
            await tx.wait();
        } catch (error) {
            console.log(chalk.red(`❌ Giao dịch thất bại: ${error.message}`));
        }

        console.log(chalk.gray("⌛ Đợi 5 giây trước giao dịch tiếp theo...\n"));
        await new Promise(res => setTimeout(res, 5000));
    }

    console.log(chalk.greenBright("\n🎉 Tất cả giao dịch đã hoàn tất!\n"));
    savedOption = null;
    savedTransactionCount = null;

    const repeat = await askQuestion(chalk.magenta("Bạn có muốn lặp lại sau 24 giờ không? (y/n): "));
    if (repeat.toLowerCase() === "y") {
        console.log(chalk.yellow("⏳ Đợi 24 giờ để chạy lại..."));
        setTimeout(autoTransaction, 24 * 60 * 60 * 1000); // 24 giờ
    } else {
        console.log(chalk.greenBright("👋 Chương trình kết thúc."));
        process.exit(0);
    }
}

// Hàm xử lý đầu vào của người dùng
async function askQuestion(query) {
    process.stdout.write(chalk.yellow(query));
    return new Promise(resolve => {
        process.stdin.once("data", data => resolve(data.toString().trim()));
    });
}

// Hàm xử lý chính
async function startProcess() {
    showBanner();
    await showWalletInfo();

    console.log(chalk.magenta("\nChọn tùy chọn:"));
    console.log(chalk.yellow("1: Triển khai hợp đồng từ nhiều ví (Chỉ một lần)"));
    console.log(chalk.yellow("2: Giao dịch tự động"));

    const choice = await askQuestion("Chọn: ");

    if (choice === "1") {
        await deployContract();
    } else if (choice === "2") {
        await autoTransaction();
    } else {
        console.log(chalk.red("❌ Tùy chọn không hợp lệ! Khởi động lại..."));
        setTimeout(startProcess, 3000);
    }
}

// Bắt đầu quá trình
startProcess();
