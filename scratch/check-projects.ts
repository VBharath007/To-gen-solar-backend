import 'dotenv/config';
import { domainRead } from '../src/store';
import { operations } from '../src/operations';

async function check() {
  try {
    const metrics = await domainRead('togen-dev', () => operations['dashboard.metrics']());
    console.log('DASHBOARD METRICS:', JSON.stringify(metrics, null, 2));

    const projects = await domainRead('togen-dev', () => operations['projects.list']());
    console.log('PROJECTS LIST:', JSON.stringify(projects, null, 2));
  } catch (e) {
    console.error('ERROR:', e);
  }
}
check();
