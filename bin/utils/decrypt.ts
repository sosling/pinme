import CryptoJS from "crypto-js";

export const decryptHash = (encryptedHash: string | undefined, key: string) => {
  try {
    if (!encryptedHash) {
      return null;
    }
    let base64 = encryptedHash.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const decrypted = CryptoJS.RC4.decrypt(base64, key);
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error: any) {
    console.error(`Decryption error: ${error.message}`);
    return encryptedHash;
  }
};
