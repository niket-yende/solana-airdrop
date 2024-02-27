const { publicKey } = require('@metaplex-foundation/umi');
const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { dasApi } = require('@metaplex-foundation/digital-asset-standard-api');
const { fetchAllDigitalAssetWithTokenByOwner } = require('@metaplex-foundation/mpl-token-metadata');

const umi = createUmi('https://api.devnet.solana.com');
const owner = publicKey('2ym8pxFZLoSiYgzmThTXCmQg6aXd37UF4jUaVTcv7T8z');
const mintAddress = 'DbKC9dkkH1uqp9B5AAhVnds935ePNtj9J6dg6htPqbAv';

async function main() {
    const assets = await fetchAllDigitalAssetWithTokenByOwner(umi, owner);
    const foundAsset = assets.find(asset => asset.publicKey.toString() === mintAddress);
    
    if (foundAsset) {
        const token = foundAsset.token;
        console.log(`token owner: ${token.owner}, balance amount: ${token.amount}`);
    } else {
        console.log("Asset with mint address not found");
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
  });