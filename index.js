import { createMetadataAccountV3, mplTokenMetadata, updateMetadataAccountV2,fetchMetadataFromSeeds, OneTimePrintingAuthorizationMintDecimalsShouldBeZeroError } from "@metaplex-foundation/mpl-token-metadata";
import { none } from "@metaplex-foundation/umi";
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { signerIdentity, createSignerFromKeypair } from '@metaplex-foundation/umi'
import {
    PublicKey,
    Connection,
    Keypair
  } from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    setAuthority, 
    AuthorityType,
  } from "@solana/spl-token";

import { BN } from "bn.js";
import bs58 from 'bs58';

import dotenv from 'dotenv';
dotenv.config();


//const isLocal = false;

let umi = createUmi(process.env.devnet_url, "confirmed");
let connection = new Connection(process.env.devnet_url, "confirmed");

if (process.env.network === "mainnet-beta") {
  umi = createUmi(process.env.mainnet_url, "confirmed");
  connection = new Connection(process.env.mainnet_url, "confirmed");
} else if (process.env.network === "local"){
  umi = createUmi(process.env.local_url);
  connection = new Connection(process.env.local_url, "confirmed");
}




console.log("start token making");



const adminKeyString = process.env.secret_key;

let b = bs58.decode(adminKeyString);
let adminSecretArray = new Uint8Array(b.buffer, b.byteOffset, b.byteLength / Uint8Array.BYTES_PER_ELEMENT);


const tokenDecimal = +process.env.token_decimal;

const keyPairAdmin = Keypair.fromSecretKey(
    Uint8Array.from(adminSecretArray),
  );

  const amount = new BN(+process.env.supply).mul(new BN(10 ** tokenDecimal));


const createTokenMain = async() =>{
    let mintAddress = await createToken();
    await createMetadata(mintAddress);
    console.log(mintAddress.toString());
    await mintTokens(mintAddress);
    await updateTokenAuthority(mintAddress);
}


const createToken = async () =>{
  let mint = await createMint(
    connection,
    keyPairAdmin,
    keyPairAdmin.publicKey,
    keyPairAdmin.publicKey,
    tokenDecimal
  );
  console.log("token mint address: " + mint.toBase58());

  return mint;
}

const createMetadata = async (mint) => {

    try {

      const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
        process.env.token_metadata_program,
      );

      const tokenMintAccount = new PublicKey(mint);
      const metadataPDAAndBump = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          tokenMintAccount.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID,
      );

      const metadataPDA = metadataPDAAndBump[0];
      let CreateMetadataAccountV3Args = {
        //accounts
        metadata: metadataPDA,
        mint: mint,
        mintAuthority: keyPairAdmin.publicKey,
        payer: keyPairAdmin.publicKey,
        updateAuthority:  keyPairAdmin.publicKey,
        // & instruction data
        data: {
          name: process.env.token_name,
          symbol: process.env.token_symbol,
          // Arweave / IPFS / Pinata etc link using metaplex standard for offchain data
          uri: process.env.token_metadata,
          sellerFeeBasisPoints: 0,
          creators: null,
          collection: null,
          uses: null,
        },
        isMutable: true,
        collectionDetails: null,
      }


      const userWallet = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(adminSecretArray));
      const userWalletSigner = createSignerFromKeypair(umi, userWallet);
      umi.use(signerIdentity(userWalletSigner));
      umi.use(mplTokenMetadata())
      
      //umi.use(keypairIdentity(initializeParams.keyPairAdmin));
      if(process.env.network !="local"){
        let myTransaction = await createMetadataAccountV3(
          umi,
          CreateMetadataAccountV3Args
        ).sendAndConfirm(umi)
  
        // const initialMetadata = await fetchMetadataFromSeeds(umi, { mint: mint });
        // console.log(myTransaction);
        // let myTransaction2 = await updateMetadataAccountV2(
        //   umi,
        //   {
        //     newUpdateAuthority: none()
        //     // mint: mint,
        //     // authority: keyPairAdmin.publicKey,
        //     // data: {
        //     //   ...initialMetadata,
        //     // },
        //     // newUpdateAuthority: none(),
        //     // isMutable: false,
        //   }
        // ).sendAndConfirm(umi);
        console.log(myTransaction);
      }




      


      



     // alert(tokenBalance.value.uiAmount);
     return mint;
    } catch (error) {
      console.log("-----Token creation error----- \n", error);
    }
}


const mintTokens = async (mint) => {
let adminAta = (
    await getOrCreateAssociatedTokenAccount(
    connection,
    keyPairAdmin,
    mint,
    keyPairAdmin.publicKey
    )
).address;
console.log("Admin associated token account address: " + adminAta.toBase58());

// minting specific number of new tokens to the adminAta we just created
await mintTo(
    connection,
    keyPairAdmin,
    mint,
    adminAta,
    keyPairAdmin.publicKey,
    BigInt(amount.toString())
);

// balance of token in adminAta
const tokenBalance = await connection.getTokenAccountBalance(adminAta);

console.log("tokenBalance in adminAta: ", tokenBalance.value.uiAmount);
}


const updateTokenAuthority = async (mint) => {

// minting specific number of new tokens to the adminAta we just created

const txMintAuth = await setAuthority(
    connection,
    keyPairAdmin,
    mint,
    keyPairAdmin.publicKey, // Current mint authority
    AuthorityType.MintTokens,
    null, // Set to null
    [],
    TOKEN_PROGRAM_ID
);

console.log("Mint Authority Removed:", txMintAuth);

const txFreezeAuth = await setAuthority(
    connection,
    keyPairAdmin,
    mint,
    keyPairAdmin.publicKey, // Current mint authority
    AuthorityType.FreezeAccount,
    null, // Set to null
    [],
    TOKEN_PROGRAM_ID
);

console.log("Freeze Authority Removed:", txFreezeAuth);


}
createTokenMain();
