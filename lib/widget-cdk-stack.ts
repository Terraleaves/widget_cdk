import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

require('dotenv').config();

const config = {
  env: {
    account: process.env.AWS_ACCOUNT_NUMBER,
    region: process.env.AWS_REGION
  }
}

export class WidgetCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, { ...props, env: config.env});

    // 1. Find default VPC for now
    const defaultVPC = ec2.Vpc.fromLookup(
      this,
      'VPC',
      { isDefault: true }
    );

    // 1.1. Configure role
    const role = new iam.Role(
      this,
      'widget-instance-role',
      { assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')}
    );

    // 1.2. Configure security group
    const sg = new ec2.SecurityGroup(
      this,
      'widget-instance-sg',
      {
        vpc: defaultVPC,
        allowAllOutbound: true,
        securityGroupName: 'widget-instance-role'
      }
    );

    // 1.3. Add rule to security group
    // Allow SSH connection
    // TODO: Currently, it allows all users to access vis ssh for testing. It's requird to change to restricted access
    sg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'Allows SSH access from Internet'
    );

    // Allow HTTP connection
    sg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allows https access from Internet'
    );

    // Allows HTTPS connection
    sg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allows https access from Internet'
    )


    // 2. Create EC2
    // TODO: Need to create key pair. Currently, anyone can access to this instance
    //Launch Template (for ASG instances)
    const launchTemplate = new ec2.LaunchTemplate(this, 'simple-instance-1', {
      role: role,
      securityGroup: sg,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO
      ),
      machineImage: ec2.MachineImage.lookup({
        name: "widget-instance-ami"
      })
    });

    // 2.1. Get public IP address
    // const publicIp = instance.instancePublicIp;

    // create auto scaling group
    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'AutoScalingGroup', {
      vpc: defaultVPC,
      launchTemplate: launchTemplate,
      minCapacity: 1,
      desiredCapacity: 1,
      maxCapacity: 3,
    });


    // Create Load Balancer
    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'LB', {
      vpc: defaultVPC,
      internetFacing: true,
      securityGroup: sg
    });

    // Add Listener to LB (for HTTP on Port 80)
    const listener = loadBalancer.addListener('Listener', {
      port: 80,
      open: true,
    });

    // Add Target Group to LB
    listener.addTargets('Target', {
      port: 80,
      targets: [autoScalingGroup],
      healthCheck: {
        path: '/',
        interval: cdk.Duration.seconds(30),
      },
    });
  }
}
