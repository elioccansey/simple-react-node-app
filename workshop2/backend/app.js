import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"; 

const s3 = new S3Client({ region: "your-region" });
const sns = new SNSClient({ region: "your-region" });
const dynamoDB = new DynamoDBClient({ region: "your-region" });

const SNS_TOPIC_ARN = "your-sns-arn";
const DYNAMODB_TABLE_NAME = "your-table";

export const handler = async (event) => {
  try {
    const { filename, contentType, email } = JSON.parse(event.body);
    console.log(filename, contentType, email);
    const bucketName = "your-bucket";

    // Generate pre-signed URL
    const uploadParams = {
      Bucket: bucketName,
      Key: filename,
      ContentType: contentType,
    };
    const command = new PutObjectCommand(uploadParams);
    
    const uploadURL = await getSignedUrl(s3, command, { expiresIn: 60 });
    
    // Save data to DynamoDB
    const timestamp = new Date().toISOString();
    const item = {
      email: { S: email },
      imageUrl: { S: `https://${bucketName}.s3.amazonaws.com/${filename}` },
      datetime: { S: timestamp },
    };

    await dynamoDB.send(new PutItemCommand({
      TableName: DYNAMODB_TABLE_NAME,
      Item: item,
    }));

    // Send SNS notification
    const snsMessage = `A new file named ${filename} was uploaded by ${email}.`;
    await sns.send(new PublishCommand({
      Message: snsMessage,
      TopicArn: SNS_TOPIC_ARN,
    }));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ uploadURL }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
