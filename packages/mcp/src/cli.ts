#!/usr/bin/env node
import { ShadowHeliconMcpServer } from "./index.js";

const server = new ShadowHeliconMcpServer();
server.startStdio();
