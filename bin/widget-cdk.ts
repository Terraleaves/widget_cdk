#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { WidgetCdkStack } from '../lib/widget-cdk-stack';

const app = new cdk.App();
new WidgetCdkStack(app, 'WidgetCdkStack');