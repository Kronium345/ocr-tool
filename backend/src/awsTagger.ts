/**
 * AWS Services and Domain categorization for exam questions
 */

export interface AWSTags {
  services: string[];
  domains: string[];
  keywords: string[];
}

// Comprehensive AWS service list for DVA-C02
const AWS_SERVICES = [
  // Compute
  "EC2", "Lambda", "Elastic Beanstalk", "ECS", "EKS", "Fargate", "Lightsail",
  
  // Storage
  "S3", "EBS", "EFS", "FSx", "Storage Gateway", "Glacier",
  
  // Database
  "RDS", "DynamoDB", "ElastiCache", "Aurora", "DocumentDB", "Neptune", "Redshift", "MemoryDB",
  
  // Networking
  "VPC", "CloudFront", "Route 53", "API Gateway", "Direct Connect", "ELB", "ALB", "NLB", "Global Accelerator",
  
  // Security & Identity
  "IAM", "Cognito", "Secrets Manager", "KMS", "Systems Manager", "Parameter Store", "WAF", "Shield", "GuardDuty", "Inspector",
  
  // Messaging & Integration
  "SQS", "SNS", "EventBridge", "Step Functions", "SWF", "Amazon MQ", "Kinesis", "AppSync",
  
  // Developer Tools
  "CodeCommit", "CodeBuild", "CodeDeploy", "CodePipeline", "CodeArtifact", "CodeGuru", "X-Ray", "CloudFormation",
  
  // Monitoring & Logging
  "CloudWatch", "CloudTrail", "Config", "Systems Manager",
  
  // Containers
  "ECR", "App Runner",
  
  // Serverless
  "SAM", "Amplify"
];

// DVA-C02 Domain categories
const DOMAINS = {
  "Development with AWS Services": [
    "Lambda", "API Gateway", "DynamoDB", "S3", "SQS", "SNS", "EventBridge", "Step Functions"
  ],
  "Security": [
    "IAM", "Cognito", "KMS", "Secrets Manager", "Parameter Store", "WAF", "X-Ray"
  ],
  "Deployment": [
    "CodeDeploy", "CodePipeline", "CodeBuild", "CodeCommit", "Elastic Beanstalk", "CloudFormation", "SAM"
  ],
  "Troubleshooting and Optimization": [
    "CloudWatch", "X-Ray", "CloudTrail", "ElastiCache", "DynamoDB", "Lambda"
  ]
};

/**
 * Tags a question with relevant AWS services and domains
 */
export function tagQuestion(text: string): AWSTags {
  const upperText = text.toUpperCase();
  const tags: AWSTags = {
    services: [],
    domains: [],
    keywords: []
  };

  // Find all mentioned AWS services
  for (const service of AWS_SERVICES) {
    const serviceUpper = service.toUpperCase();
    if (upperText.includes(serviceUpper) || upperText.includes(`AWS ${serviceUpper}`)) {
      tags.services.push(service);
    }
  }

  // Determine domain categories
  for (const [domain, services] of Object.entries(DOMAINS)) {
    const hasService = services.some(s => 
      tags.services.some(ts => ts.toUpperCase() === s.toUpperCase())
    );
    if (hasService) {
      tags.domains.push(domain);
    }
  }

  // Extract important keywords
  const keywords = [
    "serverless", "microservices", "container", "scaling", "high availability",
    "fault tolerant", "cost optimization", "performance", "security", "encryption",
    "caching", "monitoring", "logging", "deployment", "CI/CD", "blue-green",
    "canary", "rollback", "throttling", "rate limiting", "CORS", "authentication",
    "authorization", "least privilege", "IAM role", "policy", "VPC", "subnet",
    "security group", "NACL", "queue", "topic", "event-driven", "asynchronous",
    "synchronous", "idempotent", "stateless", "stateful", "cold start"
  ];

  for (const keyword of keywords) {
    if (upperText.includes(keyword.toUpperCase())) {
      tags.keywords.push(keyword);
    }
  }

  return tags;
}

