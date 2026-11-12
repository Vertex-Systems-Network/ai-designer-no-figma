import { describe,expect,it } from 'vitest';
import { parseDesignPlan } from './design-plan';

const design={schemaVersion:'1.0',name:'Site',designSystem:{colors:[{name:'Primary',color:'#006039'}]},pages:[{id:'p',name:'Home',children:[{type:'frame',id:'hero',name:'Hero',width:400,height:300,fillToken:'Primary',children:[{type:'text',id:'heading',name:'Heading',width:200,height:40,text:'Hello',fontSize:24}]}]}]};
const plan={planVersion:'1.0',brief:'A site for a studio',design,sections:[{frameId:'hero',purpose:'Introduce the studio',componentCandidates:['comp-1'],tokenNames:['Primary']}]};
const inventory={components:[{id:'comp-1'}]};

describe('versioned design plan',()=>{
  it('maps every section to a validated native spec and known component identity',()=>{
    const result=parseDesignPlan(JSON.stringify(plan),inventory);
    expect(result.valid).toBe(true);expect(result.design).toEqual(design);
  });
  it('rejects unknown or missing references rather than silently dropping them',()=>{
    expect(parseDesignPlan(JSON.stringify(plan)).issues.some(i=>i.path.endsWith('componentCandidates'))).toBe(true);
    expect(parseDesignPlan(JSON.stringify({...plan,sections:[{...plan.sections[0],frameId:'missing'}]}),inventory).valid).toBe(false);
    expect(parseDesignPlan(JSON.stringify({...plan,sections:[{...plan.sections[0],tokenNames:['Unknown']}]}),inventory).valid).toBe(false);
    expect(parseDesignPlan(JSON.stringify({...plan,sections:[{...plan.sections[0],assetIds:['heading']}]}),inventory).valid).toBe(false);
    expect(parseDesignPlan(JSON.stringify({...plan,sections:[]}),inventory).valid).toBe(false);
  });
  it('rejects unsupported plan fields, invalid embedded design and excessive input',()=>{
    expect(parseDesignPlan(JSON.stringify({...plan,script:'run()'}),inventory).valid).toBe(false);
    expect(parseDesignPlan(JSON.stringify({...plan,design:{}}),inventory).valid).toBe(false);
    expect(parseDesignPlan('x'.repeat(640001),inventory).valid).toBe(false);
  });
});
