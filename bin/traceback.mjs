#!/usr/bin/env node
import { tsImport } from 'tsx/esm/api';
await tsImport('../interfaces/cli.ts', import.meta.url);
