const { Connection, clusterApiUrl, Keypair, LAMPORTS_PER_SOL, PublicKey } = require("@solana/web3.js");
const dotenv = require("dotenv");
const fs = require("fs");
const { Metaplex, keypairIdentity, bundlrStorage, toMetaplexFile, mockStorage } = require("@metaplex-foundation/js");
const { nftStorage } = require("@metaplex-foundation/js-plugin-nft-storage");
dotenv.config();

// example data for a new NFT
const nftData = {
  name: "TestNFT",
  symbol: "TNFT",
  description: "Test NFT on Solana",
  sellerFeeBasisPoints: 0,
  imageFile: "solana.png"
}

const carNftData = {
    name: "CarNFT",
    symbol: "SOLCAR",
    description: "Sol Car NFT",
    sellerFeeBasisPoints: 0,
    imageFile: "car.jpg"
  }

// example data for updating an existing NFT
// const updateNftData = {
//   name: "Update",
//   symbol: "UPDATE",
//   description: "Update Description",
//   sellerFeeBasisPoints: 100,
//   imageFile: "success.png"
// }

/**
 * Function to create NFT.
 * Reference: https://github.com/Unboxed-Software/solana-metaplex/blob/solution/src/index.ts
 */
async function main() {
    // create a new connection to the cluster's API
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

    // initialize a keypair for the user
    const user = await initializeKeypair(connection);

    console.log("PublicKey:", user.publicKey.toBase58());

    // metaplex set up
    // const metaplex = Metaplex.make(connection)
    // .use(keypairIdentity(user))
    // .use(
    //     bundlrStorage({
    //     address: "https://devnet.bundlr.network",
    //     providerUrl: "https://api.devnet.solana.com",
    //     timeout: 60000,
    //     }),
    // );

    const metaplex = Metaplex.make(connection)
    .use(keypairIdentity(user))
    // .use(mockStorage());
    .use(nftStorage({ token: process.env.NFT_STORAGE_TOKEN }));

    // upload NFT data and get the URI for the metadata
    const uri = await uploadMetadata(metaplex, carNftData);

    // create an NFT using the helper function and the URI from the metadata
    const nft = await metaplex.nfts().create(
        {
            uri: uri,
            name: carNftData.name,
            sellerFeeBasisPoints: carNftData.sellerFeeBasisPoints,
            symbol: carNftData.symbol,
        },
        { commitment: "finalized" },
    );
    console.log(`NFT mintAddress: ${nft.mintAddress}`);
    console.log(`NFT metadataAddress: ${nft.metadataAddress}`);
    console.log(`NFT masterEditionAddress: ${nft.masterEditionAddress}`);
    console.log(`NFT tokenAddress: ${nft.tokenAddress}`);
    console.log(`NFT response blockhash: ${nft.response.blockhash}`);
    console.log(`NFT response signature: ${nft.response.signature}`);    
    console.log(`Token Mint: https://explorer.solana.com/address/${nft.mintAddress}?cluster=devnet`);
}

async function uploadMetadata(metaplex, nftData) {
    // file to buffer
    const buffer = fs.readFileSync("data/" + nftData.imageFile);
  
    // buffer to metaplex file
    const file = toMetaplexFile(buffer, nftData.imageFile);
    console.log('File name: ', file.fileName);
  
    // upload image and get image uri
    const imageUri = await metaplex.storage().upload(file);
    console.log("image uri:", imageUri);
  
    // upload metadata and get metadata uri (off chain metadata)
    const { uri } = await metaplex.nfts().uploadMetadata({
      name: nftData.name,
      symbol: nftData.symbol,
      description: nftData.description,
      image: imageUri
    });
  
    console.log("metadata uri:", uri);
    return uri;
}

async function initializeKeypair(connection) {
    if (!process.env.PRIVATE_KEY) {
      console.log("Creating .env file")
      const signer = Keypair.generate()
      fs.writeFileSync(".env", `PRIVATE_KEY=[${signer.secretKey.toString()}]`)
      await airdropSolIfNeeded(signer, connection)
  
      return signer
    }
  
    const secret = JSON.parse(process.env.PRIVATE_KEY ?? "")
    const secretKey = Uint8Array.from(secret)
    const keypairFromSecretKey = Keypair.fromSecretKey(secretKey)
    await airdropSolIfNeeded(keypairFromSecretKey, connection)
    return keypairFromSecretKey
}

async function airdropSolIfNeeded(signer, connection) {
    const balance = await connection.getBalance(signer.publicKey)
    console.log("Current balance is", balance / LAMPORTS_PER_SOL)
    const minLamports = 500000000;
    if (balance < minLamports) {
      console.log("Airdropping 1 SOL...")
      const airdropSignature = await connection.requestAirdrop(
        signer.publicKey,
        LAMPORTS_PER_SOL
      )
  
      const latestBlockHash = await connection.getLatestBlockhash()
  
      await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: airdropSignature
      })
  
      const newBalance = await connection.getBalance(signer.publicKey)
      console.log("New balance is", newBalance / LAMPORTS_PER_SOL)
    }
}

main()
  .then(() => {
    console.log("Finished successfully")
    process.exit(0)
  })
  .catch(error => {
    console.log(error)
    process.exit(1)
  })
