export interface ICryptography {
  blake3(data: Uint8Array): Promise<Uint8Array>; //This will return a Uint8Array of length 32
}
