import { writeFileSync } from 'node:fs';
const ref = name => ({ $ref: `#/components/schemas/${name}` });
const json = (schema, example) => ({ 'application/json': { schema, ...(example ? { example } : {}) } });
const uuid = { type: 'string', format: 'uuid' };
const date = { type: 'string', format: 'date-time' };
const exampleId = 'eab98b2a-6aa1-46aa-a979-27004ba440e0';
const resourceFields = {
 title: { type: 'string', minLength: 3, maxLength: 120, example: 'TypeScript Rules' },
 description: { type: 'string', minLength: 10, maxLength: 2000, example: 'Guidelines for clear, strict TypeScript code.' },
 type: { type: 'string', enum: ['SKILL','RULE'] }, categoryId: uuid,
 supportedTool: { type: 'string', minLength: 2, maxLength: 100, example: 'Claude Code' },
 usageInstructions: { type: 'string', minLength: 10, maxLength: 10000, example: 'Save in .claude/rules/typescript.md in the project.' }
};
const resourceExample = { id:exampleId, title:'TypeScript Rules', description:'Guidelines for clear, strict TypeScript code.', type:'RULE', categoryId:exampleId, category:{id:exampleId,name:'איכות קוד'}, supportedTool:'Claude Code', usageInstructions:'Save in .claude/rules/typescript.md in the project.', fileName:'typescript.md', fileSize:320,mimeType:'text/plain; charset=utf-8',isActive:true,downloadCount:0,createdAt:'2026-01-01T12:00:00Z',updatedAt:'2026-01-01T12:00:00Z' };
const schemas = {
 Error:{type:'object',required:['error'],properties:{error:{type:'object',required:['code','message'],properties:{code:{type:'string'},message:{type:'string'},requestId:{type:'string'},details:{type:'object',additionalProperties:{type:'array',items:{type:'string'}}}}}}},
 User:{type:'object',required:['id','displayName','email','role'],properties:{id:uuid,displayName:{type:'string'},email:{type:'string',format:'email'},role:{type:'string',enum:['USER','ADMIN']}}},
 AuthSession:{type:'object',required:['user','accessToken','tokenType','expiresIn'],properties:{user:ref('User'),accessToken:{type:'string',description:'JWT; keep private'},tokenType:{type:'string',enum:['Bearer']},expiresIn:{type:'integer',example:3600}}},
 Category:{type:'object',required:['id','name'],properties:{id:uuid,name:{type:'string'}}},
 Categories:{type:'object',required:['items'],properties:{items:{type:'array',items:ref('Category')}}},
 Resource:{type:'object',required:Object.keys(resourceExample),properties:{id:uuid,...resourceFields,category:ref('Category'),fileName:{type:'string'},fileSize:{type:'integer',minimum:1,maximum:1048576},mimeType:{type:'string'},isActive:{type:'boolean'},downloadCount:{type:'integer',minimum:0},createdAt:date,updatedAt:date},example:resourceExample},
 ResourcePage:{type:'object',required:['items','totalCount','page','pageSize','totalPages'],properties:{items:{type:'array',items:ref('Resource')},totalCount:{type:'integer'},page:{type:'integer'},pageSize:{type:'integer'},totalPages:{type:'integer'}}},
 Favorites:{type:'object',required:['items'],properties:{items:{type:'array',items:ref('Resource')}}},
 Register:{type:'object',additionalProperties:false,required:['displayName','email','password'],properties:{displayName:{type:'string',minLength:2,maxLength:80},email:{type:'string',format:'email',maxLength:254},password:{type:'string',format:'password',minLength:10,maxLength:72,description:'Uppercase and lowercase Latin letters plus a digit; max 72 UTF-8 bytes.'}}},
 Login:{type:'object',additionalProperties:false,required:['email','password'],properties:{email:{type:'string',format:'email',maxLength:254},password:{type:'string',format:'password',minLength:1,maxLength:72,description:'Maximum 72 UTF-8 bytes; prevents bcrypt truncation.'}}},
 ResourceCreate:{type:'object',additionalProperties:false,required:[...Object.keys(resourceFields),'file'],properties:{...resourceFields,file:{type:'string',format:'binary',description:'One UTF-8 .md, .txt or .json file, max 1 MiB, ASCII filename.'}}},
 ResourceUpdate:{type:'object',additionalProperties:false,properties:{...resourceFields,isActive:{type:'boolean'},file:{type:'string',format:'binary',description:'Optional replacement UTF-8 file, max 1 MiB.'}}},
 ResourceUpdateJson:{type:'object',additionalProperties:false,minProperties:1,properties:{...resourceFields,isActive:{type:'boolean'}}},
 Health:{type:'object',required:['status','database'],properties:{status:{type:'string',enum:['healthy','unhealthy']},database:{type:'string',enum:['connected','unavailable']}}}
};
const descriptions = {400:'נתוני הבקשה אינם תקינים',401:'נדרשת התחברות תקפה',403:'אין הרשאה לפעולה או שמקור הדפדפן אינו מורשה',404:'הרשומה לא נמצאה',409:'הרשומה כבר קיימת',413:'הבקשה או הקובץ גדולים מדי',415:'סוג או תוכן הקובץ אינם נתמכים',429:'בקשות רבות מדי; יש להמתין',500:'שגיאה פנימית; פרטים רגישים אינם נחשפים'};
const errors = codes => Object.fromEntries(codes.map(c=>[c,{description:descriptions[c],content:json(ref('Error'),{error:{code:c===401?'UNAUTHORIZED':'ERROR',message:descriptions[c]}})}]));
const idParam = name => ({name,in:'path',required:true,schema:uuid});
const queryParams = [
 {name:'search',in:'query',schema:{type:'string',maxLength:100},description:'חיפוש בשם ובתיאור; אינו רגיש לאותיות גדולות באנגלית'},
 {name:'type',in:'query',schema:{type:'string',enum:['SKILL','RULE']}},
 {name:'categoryId',in:'query',schema:uuid},
 {name:'page',in:'query',schema:{type:'integer',minimum:1,maximum:100000,default:1}},
 {name:'pageSize',in:'query',schema:{type:'integer',minimum:1,maximum:24,default:12}}
];
function op(id,summary,tag,secured=false) {return {operationId:id,summary,tags:[tag],security:secured?[{bearerAuth:[]}]:[]};}
function response(schema, example) {return {description:'הפעולה הצליחה',content:json(ref(schema),example)};}
const paths = {
 '/api/auth/register':{post:{...op('register','הרשמה לחשבון USER בלבד','Authentication'),description:'אין אפשרות לבחור תפקיד מנהל. דוא״ל מנורמל לאותיות קטנות. יש להשתמש בסיסמה פרטית חדשה.',requestBody:{required:true,content:json(ref('Register'))},responses:{201:response('AuthSession'),...errors([400,409,429,500])}}},
 '/api/auth/login':{post:{...op('login','התחברות וקבלת JWT','Authentication'),requestBody:{required:true,content:json(ref('Login'))},responses:{200:response('AuthSession'),...errors([400,401,429,500])}}},
 '/api/auth/me':{get:{...op('me','פרטי המשתמש המזוהה','Authentication',true),responses:{200:response('User'),...errors([401,429,500])}}},
 '/api/categories':{get:{...op('categories','רשימת קטגוריות מוכנות','Catalog'),responses:{200:response('Categories'),...errors([429,500])}}},
 '/api/resources':{get:{...op('resources','משאבים פעילים עם חיפוש, סינון ועימוד','Catalog'),description:'סדר קבוע: החדשים תחילה. אין בחירת מיון בגרסה זו. שדות לא מוכרים נדחים.',parameters:queryParams,responses:{200:response('ResourcePage',{items:[resourceExample],totalCount:1,page:1,pageSize:12,totalPages:1}),...errors([400,429,500])}}},
 '/api/resources/{id}':{get:{...op('resource','פרטי משאב פעיל והוראות שימוש','Catalog'),parameters:[idParam('id')],responses:{200:response('Resource'),...errors([400,404,429,500])}}},
 '/api/resources/{id}/download':{get:{...op('download','הורדת הקובץ המקורי','Downloads',true),description:'נדרשת התחברות. קובץ מוחזר כ-attachment; כל בקשת הורדה מאושרת מגדילה מונה. לא ניתן להוכיח שהקובץ נשמר במחשב. React צריך לשלוח Authorization גם בהורדה.',parameters:[idParam('id')],responses:{200:{description:'קובץ להורדה',headers:{'Content-Disposition':{schema:{type:'string'},description:'attachment; filename="SKILL.md"'}},content:{'text/plain':{schema:{type:'string',format:'binary'}},'application/json':{schema:{type:'string',format:'binary'}}}},...errors([400,401,404,429,500])}}},
 '/api/favorites':{get:{...op('favorites','המועדפים של המשתמש המזוהה בלבד','Favorites',true),description:'משאבים מוסתרים אינם מוחזרים. אין פרמטר userId.',responses:{200:response('Favorites'),...errors([401,429,500])}}},
 '/api/favorites/{resourceId}':{
  put:{...op('addFavorite','שמירה במועדפים; פעולה חוזרת אינה יוצרת כפילות','Favorites',true),parameters:[idParam('resourceId')],responses:{204:{description:'נשמר; ללא גוף תשובה'},...errors([400,401,404,429,500])}},
  delete:{...op('removeFavorite','הסרה מהמועדפים האישיים בלבד','Favorites',true),parameters:[idParam('resourceId')],responses:{204:{description:'הוסר או שכבר לא היה שמור; ללא גוף תשובה'},...errors([400,401,429,500])}}
 },
 '/api/admin/resources':{
  get:{...op('adminResources','מנהל: רשימת משאבים, כולל מוסתרים','Administration',true),description:'הרשאת ADMIN בלבד. כולל את כל שדות העריכה; אינו כולל תוכן הקבצים.',parameters:queryParams,responses:{200:response('ResourcePage'),...errors([400,401,403,429,500])}},
  post:{...op('createResource','מנהל: יצירת משאב עם קובץ אחד','Administration',true),description:'הרשאת ADMIN בלבד. הקובץ נשמר במסד הנתונים ואינו מורץ. אין לשלוח fileData, downloadCount או תפקיד משתמש.',requestBody:{required:true,content:{'multipart/form-data':{schema:ref('ResourceCreate')}}},responses:{201:response('Resource'),...errors([400,401,403,413,415,429,500])}}
 },
 '/api/admin/resources/{id}':{patch:{...op('updateResource','מנהל: עריכה, החלפת קובץ או שינוי פרסום','Administration',true),description:'הרשאת ADMIN בלבד. לפחות שדה אחד או קובץ. isActive=false מסתיר, true מפרסם מחדש. אין מחיקה קבועה בגרסה זו.',parameters:[idParam('id')],requestBody:{required:true,content:{'multipart/form-data':{schema:ref('ResourceUpdate')},...json(ref('ResourceUpdateJson'),{isActive:false})}},responses:{200:response('Resource'),...errors([400,401,403,404,413,415,429,500])}}},
 '/api/health':{get:{...op('health','תקינות השרת והחיבור למסד הנתונים','System'),responses:{200:response('Health',{status:'healthy',database:'connected'}),503:{description:'מסד הנתונים אינו זמין',content:json(ref('Health'),{status:'unhealthy',database:'unavailable'})}}}}
};
const spec = {openapi:'3.0.3',info:{title:'SkillShelf API',version:'1.0.0',description:'קטלוג Skills ו-Rules להורדה. אין התקנה אוטומטית או שירות AI. לפני קריאות מוגנות: הרשמה או התחברות, העתקת accessToken לכפתור Authorize. משתמש: הורדות ומועדפים. מנהל: ניהול משאבים. קבצים ותוכן הם מידע בלבד, ולא נבדקו מול כל גרסה של כלי חיצוני.'},servers:[{url:'/',description:'השרת שממנו נפתח Swagger'}],tags:['Authentication','Catalog','Downloads','Favorites','Administration','System'].map(name=>({name})),paths,components:{securitySchemes:{bearerAuth:{type:'http',scheme:'bearer',bearerFormat:'JWT'}},schemas}};
writeFileSync('openapi.json',JSON.stringify(spec,null,2)+'\n');
console.log('OpenAPI document generated');
