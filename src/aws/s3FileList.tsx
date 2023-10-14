// packages/s3-file-list/src/S3FileList.tsx

import React, { useEffect, useState } from "react";
import { createSTSClient } from "./awsconfig"; // Adjust the import path
import { ListObjectsCommand, GetObjectCommand, GetObjectCommandOutput } from "@aws-sdk/client-s3";
import fileDownload from "js-file-download";
import { LRUCache } from "lru-cache";

// Create a cache with a maximum size and TTL of 1 hour (in milliseconds)
const cache = new LRUCache({ max: 100, ttl: 60 * 60 * 1000 });

interface S3Object {
  Key: string;
  // Add any other properties you need here
}

const jwtToken =
  "eyJraWQiOiJCZzZMelpBU3RMcUYwbGh3ekZrN1BTWE9GZ3JtZlZBWjROSmQwZHY5Vzk4PSIsImFsZyI6IlJTMjU2In0.eyJhdF9oYXNoIjoiZXhZbDVvZkoyZURIODN1bTM2RUJ4dyIsInN1YiI6ImZhNTM2ODgyLWVlYTMtNDY5MC1hNDkyLWRiZDZmZjFhYjE2MyIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAuYXAtc291dGhlYXN0LTIuYW1hem9uYXdzLmNvbVwvYXAtc291dGhlYXN0LTJfNTh1SWxydG1jIiwiY29nbml0bzp1c2VybmFtZSI6ImtlbnR3b25nIiwib3JpZ2luX2p0aSI6IjhkZjFjYWIxLTFhMTEtNDNmNy1iMTI3LTEwNGE1ZjI4ODViZSIsImF1ZCI6IjJqaDMycmRrNTY5dWpiYzM5MHJhZWc5cGphIiwidG9rZW5fdXNlIjoiaWQiLCJhdXRoX3RpbWUiOjE2OTcyODgwMDcsImV4cCI6MTY5NzI4ODMwNywiaWF0IjoxNjk3Mjg4MDA3LCJqdGkiOiI1MTI4YzZkYi1mZTk3LTQ1MDktODkwNi01NjQ3NjZkY2RjNGYiLCJlbWFpbCI6ImtlbnRfd29uZ0BvdXRsb29rLmNvbSJ9.A3uNGxU3Mnj3aGwN4RUmHkwXMZGknKoabjz9ZnzVA-lusMeVIOcX9rghHzcf1v3rzxJ1nSkOoxAUEhRSvO9mnUHaDCpOyzVTvAp9T5Hr-yV5IwnBGTCSlwHxSRuyg7C0fkfcAecuyHZPv7qGTgti8UeAC-OzpZKsa8g63l3Wl0SL5Hrd5E9ODbn2us0rqsFavjh28kiTQOq9hBPWEm5KWnB9mPaEU72GDp6XXw1Qup-ooIIzwXCEewyrd2LKu6gmAZ5aWQu1iftTNg3QeF4D-BxiDpRcHj-W6vuXrddIkUK02qTx-UBzSH1A4Hp4aGA0nPIoT_6Ql8fKsEuusaD4Og";
const roleArn = "arn:aws:iam::724090930373:role/s3-test-role";
const sessionName = "your-session-name";

export function S3FileList() {
  const [fileList, setFileList] = useState<S3Object[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchS3Files() {
      try {
        // Check if the STS token is in the cache
        const cachedToken = cache.get("stsToken");
        let s3Client;

        if (cachedToken) {
          console.log("Using cached STS token");
          s3Client = cachedToken;
        } else {
          console.log("Requesting a new STS token");
          s3Client = await createSTSClient(jwtToken, roleArn, sessionName);

          // Store the STS token in the cache
          cache.set("stsToken", s3Client);
        }
        const response = await s3Client.send(new ListObjectsCommand({ Bucket: "s3-bucket-sdk-demo" }));
        setFileList((response.Contents ?? []) as S3Object[]);
      } catch (err: any) {
        setError("Error listing S3 objects: " + (err.message || "Unknown error"));
      } finally {
        setLoading(false);
      }
    }

    fetchS3Files();
  }, []);

  function downloadCSVFromString(csvContent, fileName) {
    // Create a Blob with the CSV content and set the MIME type
    const blob = new Blob([csvContent], { type: "text/csv" });

    // Create a data URI for the Blob
    const dataURI = URL.createObjectURL(blob);

    // Create an <a> element to trigger the download
    const downloadLink = document.createElement("a");
    downloadLink.href = dataURI;
    downloadLink.download = fileName; // Set the file name

    // Programmatically click the <a> element to trigger the download
    downloadLink.click();

    // Clean up by revoking the data URI
    URL.revokeObjectURL(dataURI);
  }

  function downloadCSVFromReadableStream(readableStream, fileName) {
    // Create a new TextDecoder to convert the stream's data to text
    const textDecoder = new TextDecoder("utf-8");

    const chunks = [];

    // Read the data from the ReadableStream
    const reader = readableStream.getReader();

    function read() {
      return reader.read().then(({ done, value }) => {
        if (done) {
          // All data has been read, concatenate the chunks and create the CSV
          const csvData = chunks.join("");
          const blob = new Blob([csvData], { type: "text/csv" });

          // Create a data URI for the Blob
          const dataURI = URL.createObjectURL(blob);

          // Create an <a> element to trigger the download
          const downloadLink = document.createElement("a");
          downloadLink.href = dataURI;
          downloadLink.download = fileName; // Set the file name

          // Programmatically click the <a> element to trigger the download
          downloadLink.click();

          // Clean up by revoking the data URI
          URL.revokeObjectURL(dataURI);
        } else {
          // Append the value to the chunks
          chunks.push(textDecoder.decode(value));
          return read(); // Continue reading
        }
      });
    }

    read(); // Start reading the stream
  }

  function saveBlobToFile(blob, fileName) {
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
  }

  async function downloadFile(key: string) {
    try {
      // const s3Client = await createSTSClient(jwtToken, roleArn, sessionName);
      // Check if the STS token is in the cache
      const cachedToken = cache.get("stsToken");
      let s3Client;

      if (cachedToken) {
        console.log("Using cached STS token");
        s3Client = cachedToken;
      } else {
        console.log("Requesting a new STS token");
        s3Client = await createSTSClient(jwtToken, roleArn, sessionName);

        // Store the STS token in the cache
        cache.set("stsToken", s3Client);
      }
      const response = await s3Client.send(new GetObjectCommand({ Bucket: "s3-bucket-sdk-demo", Key: key }));

      // WHAT SHOULD BE HERE TO DOWNLOAD S3 FILE AS A FILE TO MY COMPUTER? #################
      // !This is working fine - Option 1
      // const str = await response.Body?.transformToString();
      // console.log("str: ", str);
      // downloadCSVFromString(str, "fileName.csv");

      // Option 2 - use stream. - This is also working
      // const stream = await response.Body.transformToWebStream();
      // // console.log("str: ", str);
      // downloadCSVFromReadableStream(stream, "stream.csv");

      // Option 3 - save file blob directly. It is streaming BLOB value.
      // const reader = response.Body.getReader();
      // // Create initial empty blob
      // let totalBlob = new Blob();

      // while (true) {
      //   const { done, value } = await reader.read();

      //   if (done) {
      //     saveBlobToFile(totalBlob, key);
      //     break;
      //   }

      //   // Concatenate new chunk blob
      //   totalBlob = new Blob([totalBlob, value]);
      // }

      // Option 4 - use js-file-download
      const reader = response.Body.getReader();
      // Create initial empty blob
      let totalBlob = new Blob();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          fileDownload(totalBlob, key);
          break;
        }

        // Concatenate new chunk blob
        totalBlob = new Blob([totalBlob, value]);
      }

      // End of file handling ####################
    } catch (err: any) {
      setError("Error downloading file: " + (err || "Unknown error"));
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>S3 File List</h1>
      {error ? (
        <div>Error: {error}</div>
      ) : (
        <ul>
          {fileList.map((file) => (
            <li key={file.Key}>
              {file.Key}
              <button onClick={() => downloadFile(file.Key)}>Download</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
