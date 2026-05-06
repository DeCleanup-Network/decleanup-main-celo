import * as fs from "fs";
import * as path from "path";
// import { ethers } from "ethers";

// Utility function to convert network name to camel case
function toCamelCase(str: string): string {
  return str
    .split("-")
    .map((part, index) => {
      if (index === 0) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}

// Utility function to convert network name to Pascal case
function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

interface NetworkConfig {
  chainId: number;
  path: string;
}

interface ContractInfo {
  name: string;
  path: string;
}

interface Networks {
  [key: string]: NetworkConfig;
}

async function main() {
  // Get network name from command line argument
  const networkName = process.argv[2];
  if (!networkName) {
    console.error("Please provide a network name as an argument");
    process.exit(1);
  }

  // Define network configuration
  const networks: Networks = {
    "arbitrum-sepolia": {
      chainId: 421614,
      path: "arbitrum-sepolia",
    },
    arbitrum: {
      chainId: 42161,
      path: "arbitrum",
    },
  };

  if (!networks[networkName]) {
    console.error(`Network ${networkName} is not supported`);
    process.exit(1);
  }

  const networkConfig = networks[networkName];
  const networkClassName = toPascalCase(networkName) + "Contracts";

  const contracts: ContractInfo[] = [
    { name: "DCURewardManager", path: "DCURewardManager.sol" },
    { name: "ImpactProductNFT", path: "tokens/ImpactProductNFT.sol" },
    { name: "Submission", path: "Submission.sol" },
    { name: "ClaimVault", path: "ClaimVault.sol" },
    { name: "CDCUToken", path: "tokens/CDCUToken.sol" },
  ];

  // Read deployment addresses
  const deploymentsPath = path.join(__dirname, "deployed_addresses.json");
  if (!fs.existsSync(deploymentsPath)) {
    console.error(
      `Deployment addresses file not found for network: ${networkName}`
    );
    process.exit(1);
  }
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));

  // Create package directory
  const packageDir = path.join(__dirname, "../package");
  if (!fs.existsSync(packageDir)) {
    fs.mkdirSync(packageDir);
  }

  // Create package.json for the package directory
  const packageJsonForBuild = {
    name: "@decleanup/contracts",
    version: process.env.npm_package_version || "1.0.0",
    description: "DeCleanup Network Smart Contracts",
    main: "index.js",
    types: "index.d.ts",
    files: ["*.js", "*.d.ts", `${networkName}/**/*`],
    repository: {
      type: "git",
      url: "git+https://github.com/decleanup/DeCleanup_Network.git",
    },
    keywords: ["ethereum", "arbitrum", "smart-contracts"],
    author: "DeCleanup Network",
    license: "MIT",
    bugs: {
      url: "https://github.com/decleanup/DeCleanup_Network/issues",
    },
    homepage: "https://github.com/decleanup/DeCleanup_Network#readme",
    dependencies: {
      ethers: "^5.7.2",
    },
  };

  fs.writeFileSync(
    path.join(packageDir, "package.json"),
    JSON.stringify(packageJsonForBuild, null, 2)
  );

  // Create network directory
  const networkDir = path.join(packageDir, networkConfig.path);
  if (!fs.existsSync(networkDir)) {
    fs.mkdirSync(networkDir, { recursive: true });
  }

  // Create network config file
  const networkConfigFile = {
    chainId: networkConfig.chainId,
    ...Object.fromEntries(
      contracts.map((contract) => [contract.name, deployments[contract.name]])
    ),
  };
  fs.writeFileSync(
    path.join(networkDir, "config.json"),
    JSON.stringify(networkConfigFile, null, 2)
  );

  // Generate network-specific index.js
  let networkIndexJs = "";
  let networkIndexDts = "";

  // Generate contract factory imports for this network
  for (const contract of contracts) {
    networkIndexJs += `const ${
      contract.name
    }Factory = require('./typechain/factories/contracts/${contract.path.replace(
      ".sol",
      ""
    )}__factory').${contract.name}__factory;\n`;
  }
  networkIndexJs += `\n`;

  // Generate network-specific class
  networkIndexJs += `class ${networkClassName} {\n`;
  networkIndexJs += `  constructor() {\n`;
  networkIndexJs += `    this.config = require('./config.json');\n`;
  networkIndexJs += `  }\n\n`;

  // Add contract getters
  for (const contract of contracts) {
    networkIndexJs += `  get ${contract.name}() {\n`;
    networkIndexJs += `    return {\n`;
    networkIndexJs += `      address: this.config.${contract.name},\n`;
    networkIndexJs += `      abi: require('./artifacts/${contract.name}/abi.json'),\n`;
    networkIndexJs += `      bytecode: require('./artifacts/${contract.name}/bytecode.json').bytecode,\n`;
    networkIndexJs += `      network: '${networkName}',\n`;
    networkIndexJs += `      chainId: this.config.chainId,\n`;
    networkIndexJs += `      factory: ${contract.name}Factory,\n`;
    networkIndexJs += `      connect: (signer) => ${contract.name}Factory.connect(this.config.${contract.name}, signer)\n`;
    networkIndexJs += `    };\n`;
    networkIndexJs += `  }\n\n`;
  }

  networkIndexJs += `}\n\n`;
  networkIndexJs += `module.exports = ${networkClassName};\n`;

  // Generate network-specific TypeScript declarations
  networkIndexDts += `import { ethers } from 'ethers';\n\n`;
  for (const contract of contracts) {
    networkIndexDts += `import { ${
      contract.name
    }__factory } from './typechain/factories/contracts/${contract.path.replace(
      ".sol",
      ""
    )}__factory';\n`;
    networkIndexDts += `import { ${
      contract.name
    } } from './typechain/contracts/${contract.path.replace(".sol", "")}';\n`;
  }
  networkIndexDts += `\n`;

  networkIndexDts += `export interface ContractConfig<T = any> {\n`;
  networkIndexDts += `  address: string;\n`;
  networkIndexDts += `  abi: any[];\n`;
  networkIndexDts += `  bytecode: string;\n`;
  networkIndexDts += `  network: '${networkName}';\n`;
  networkIndexDts += `  chainId: number;\n`;
  networkIndexDts += `  factory: T;\n`;
  networkIndexDts += `  connect: (signer: ethers.Signer) => T;\n`;
  networkIndexDts += `}\n\n`;

  networkIndexDts += `export class ${networkClassName} {\n`;
  for (const contract of contracts) {
    networkIndexDts += `  get ${contract.name}(): ContractConfig<${contract.name}>;\n`;
  }
  networkIndexDts += `}\n`;

  // Write network-specific files
  fs.writeFileSync(path.join(networkDir, "index.js"), networkIndexJs);
  fs.writeFileSync(path.join(networkDir, "index.d.ts"), networkIndexDts);

  // Copy TypeChain types
  const typechainDir = path.join(__dirname, "../typechain-types");
  const networkTypechainDir = path.join(networkDir, "typechain");
  if (!fs.existsSync(networkTypechainDir)) {
    fs.mkdirSync(networkTypechainDir, { recursive: true });
  }

  // Copy all TypeChain files
  const copyTypechainFiles = (src: string, dest: string) => {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        copyTypechainFiles(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  };

  copyTypechainFiles(typechainDir, networkTypechainDir);

  // Create artifacts directory for network
  const artifactsDir = path.join(networkDir, "artifacts");
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // Copy contract artifacts
  for (const contract of contracts) {
    const contractDir = path.join(artifactsDir, contract.name);
    if (!fs.existsSync(contractDir)) {
      fs.mkdirSync(contractDir, { recursive: true });
    }

    const artifactPath = path.join(
      __dirname,
      "../artifacts/contracts",
      contract.path,
      contract.name + ".json"
    );
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    // Save ABI
    fs.writeFileSync(
      path.join(contractDir, "abi.json"),
      JSON.stringify(artifact.abi, null, 2)
    );

    // Save bytecode
    fs.writeFileSync(
      path.join(contractDir, "bytecode.json"),
      JSON.stringify({ bytecode: artifact.bytecode }, null, 2)
    );
  }

  // Generate main index.js content
  let indexJs = "";
  let indexDts = "";

  // Add networks enum
  indexJs += `const Networks = {\n`;
  indexJs += `  ARBITRUM_SEPOLIA: 'arbitrum-sepolia',\n`;
  indexJs += `  ARBITRUM: 'arbitrum'\n`;
  indexJs += `};\n\n`;
  indexJs += `exports.Networks = Networks;\n\n`;

  // Import all network-specific classes
  for (const [netName, netConfig] of Object.entries(networks)) {
    const netClassName = toPascalCase(netName) + "Contracts";
    indexJs += `const ${netClassName} = require('./${netConfig.path}');\n`;
  }
  indexJs += `\n`;

  // Generate main class
  indexJs += `class DCUContracts {\n`;
  indexJs += `  constructor(network) {\n`;
  indexJs += `    if (!Object.values(Networks).includes(network)) {\n`;
  indexJs += `      throw new Error(\`Network \${network} not supported\`);\n`;
  indexJs += `    }\n`;
  indexJs += `    this.network = network;\n`;
  indexJs += `    switch(network) {\n`;
  for (const [netName, netConfig] of Object.entries(networks)) {
    const netClassName = toPascalCase(netName) + "Contracts";
    indexJs += `      case Networks.${netName
      .toUpperCase()
      .replace("-", "_")}:\n`;
    indexJs += `        this.networkInstance = new ${netClassName}();\n`;
    indexJs += `        break;\n`;
  }
  indexJs += `      default:\n`;
  indexJs += `        throw new Error(\`Network \${network} not supported\`);\n`;
  indexJs += `    }\n`;
  indexJs += `  }\n\n`;

  // Add contract getters
  for (const contract of contracts) {
    indexJs += `  get ${contract.name}() {\n`;
    indexJs += `    return this.networkInstance.${contract.name};\n`;
    indexJs += `  }\n\n`;
  }

  indexJs += `}\n\n`;
  indexJs += `exports.DCUContracts = DCUContracts;\n`;

  // Generate main TypeScript declarations
  indexDts += `import { ethers } from 'ethers';\n\n`;

  // Import all network-specific classes in TypeScript declarations
  for (const [netName, netConfig] of Object.entries(networks)) {
    const netClassName = toPascalCase(netName) + "Contracts";
    indexDts += `import { ${netClassName} } from './${netConfig.path}';\n`;
  }
  indexDts += `\n`;

  indexDts += `export enum Networks {\n`;
  indexDts += `  ARBITRUM_SEPOLIA = 'arbitrum-sepolia',\n`;
  indexDts += `  ARBITRUM = 'arbitrum'\n`;
  indexDts += `}\n\n`;

  indexDts += `export interface ContractConfig<T = any> {\n`;
  indexDts += `  address: string;\n`;
  indexDts += `  abi: any[];\n`;
  indexDts += `  bytecode: string;\n`;
  indexDts += `  network: Networks;\n`;
  indexDts += `  chainId: number;\n`;
  indexDts += `  factory: T;\n`;
  indexDts += `  connect: (signer: ethers.Signer) => T;\n`;
  indexDts += `}\n\n`;

  indexDts += `export class DCUContracts {\n`;
  indexDts += `  constructor(network: Networks);\n`;
  for (const contract of contracts) {
    indexDts += `  get ${contract.name}(): ContractConfig<${contract.name}>;\n`;
  }
  indexDts += `}\n`;

  // Write main files
  fs.writeFileSync(path.join(packageDir, "index.js"), indexJs);
  fs.writeFileSync(path.join(packageDir, "index.d.ts"), indexDts);

  console.log(`Package generated successfully for network: ${networkName}!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
