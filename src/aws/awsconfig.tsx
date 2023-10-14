// awsconfig.ts

import { STSClient, AssumeRoleWithWebIdentityCommand } from "@aws-sdk/client-sts";
import { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";
import { AwsCredentialIdentity } from "@aws-sdk/types";

async function createSTSClient(jwtToken: string, roleArn: string, sessionName: string): Promise<S3Client> {
  console.log('do i reach here?')
    const stsClient = new STSClient({region: "ap-southeast-2"});
  const assumeRoleCommand = new AssumeRoleWithWebIdentityCommand({
    RoleArn: roleArn,
    RoleSessionName: sessionName,
    WebIdentityToken: jwtToken,
  });

  try {
    console.log('in the try block')
    const response = await stsClient.send(assumeRoleCommand);
    console.log("yay - credentials obtained: ", response);
    const tempCredentials = response.Credentials;

    console.log('checking error')
    if (!tempCredentials) {
      throw new Error("Temporary credentials are undefined.");
    }
    console.log('is there error')

    const credentials: AwsCredentialIdentity = {
      accessKeyId: tempCredentials.AccessKeyId ?? "",
      secretAccessKey: tempCredentials.SecretAccessKey ?? "",
      sessionToken: tempCredentials.SessionToken ?? "",
    };

    console.log('use the region:')
    const s3Config: S3ClientConfig = {
      region: "ap-southeast-2", // Replace with your AWS region
      credentials: credentials,
    };

    const s3Client = new S3Client(s3Config);

    return s3Client;
  } catch (error) {
    console.error("Error assuming role:", error);
    throw error;
  }
}

export { createSTSClient };
