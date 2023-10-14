// packages/s3-file-list/src/S3FileList.tsx

import React, { useEffect, useState } from "react";
import { createSTSClient } from "./awsconfig"; // Adjust the import path
import { ListObjectsCommand, GetObjectCommand, GetObjectCommandOutput } from "@aws-sdk/client-s3";
import fileDownload from "js-file-download";
import Readable from "stream";
import { saveAs } from "file-saver";
import { Stream } from "stream"; // Import the stream module
import { LRUCache } from "lru-cache";

// Create a cache with a maximum size and TTL of 1 hour (in milliseconds)
const cache = new LRUCache({ max: 100, ttl: 60 * 60 * 1000 });

interface S3Object {
  Key: string;
  // Add any other properties you need here
}

const jwtToken = "REDACTED";
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

      // Option 3 - save file blob directly.
      const reader = response.Body.getReader();
      // Create initial empty blob
      let totalBlob = new Blob();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          saveBlobToFile(totalBlob, key);
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
