import {defineConfig} from 'vitest/config';
import path from 'node:path';
export default defineConfig({envDir:false,test:{environment:'node',include:['tests/unit/standalone/**/*.test.ts'],globals:true},resolve:{alias:{'@':path.resolve(__dirname,'src'),'server-only':path.resolve(__dirname,'tests/unit/standalone/server-only.ts')}}});
