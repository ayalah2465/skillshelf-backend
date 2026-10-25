import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from './client.js';
import { emailSchema, passwordSchema } from '../auth/auth.schemas.js';

function stableId(key: string): string {
  const hex = createHash('sha256').update(`skillshelf-v1:${key}`).digest('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
const groups = [
  { name: 'איכות קוד', entries: [
    ['typescript', 'כללי TypeScript', 'RULE', 'קוד ברור עם טיפוסים מפורשים וללא any מיותר.', 'Use strict TypeScript. Prefer unknown to any and narrow values before use. Keep public function input and output types explicit. Explain tradeoffs before introducing a new dependency.'],
    ['small-functions', 'פונקציות ממוקדות', 'RULE', 'כללים לפונקציות קצרות, שמות ברורים ואחריות מוגדרת.', 'Keep each function focused on one responsibility. Use descriptive names. Avoid deeply nested control flow. Do not refactor unrelated code while addressing a small change.'],
    ['review', 'סקירת קוד ממוקדת', 'SKILL', 'תהליך סקירה לאיתור תקלות, בעיות הרשאות וחוסר בבדיקות.', 'Read the requested diff and relevant surrounding code. Identify correctness and authorization issues first. Cite exact files and lines. Separate confirmed defects from open questions. Do not change files unless asked.'],
  ]},
  { name: 'בדיקות', entries: [
    ['test-plan', 'תכנון בדיקות', 'SKILL', 'הכנת מקרי בדיקה להתנהגות תקינה, שגיאות והרשאות.', 'Identify user-visible behavior and risks. Propose success, invalid-input, missing-authentication and permission-denied cases. Use the existing test framework. Never claim a test ran unless it actually ran.'],
    ['test-rules', 'כללי כתיבת בדיקות', 'RULE', 'בדיקות עצמאיות וברורות שאינן תלויות בסדר ההרצה.', 'Test observable behavior rather than implementation details. Keep test data isolated. Use deterministic assertions. Do not disable assertions or silently skip failures.'],
    ['bug-repro', 'שחזור תקלה', 'SKILL', 'איסוף צעדי שחזור ובדיקה שמוכיחה תיקון של תקלה.', 'Read the reported behavior. Identify the smallest reproducible case. Distinguish environment failures from application defects. Propose a regression test and report actual execution results.'],
  ]},
  { name: 'תיעוד', entries: [
    ['readme', 'כתיבת README', 'SKILL', 'ארגון הוראות התקנה, הפעלה ובדיקות לפרויקט.', 'Inspect the package scripts and configuration examples. Document prerequisites, installation, database setup, startup and tests. Explain what each command does. Never include actual credentials.'],
    ['api-docs', 'תיעוד API', 'SKILL', 'הסבר של בקשות, תשובות, הרשאות וקודי שגיאה.', 'Inspect actual routes and validation schemas. Document each method, path, permission, request and response. Use fictional examples. State any behavior that could not be verified.'],
    ['plain-language', 'תיעוד בשפה ברורה', 'RULE', 'כללים להסברים קצרים ומדויקים למפתחים מתחילים.', 'Use plain language and explain unfamiliar terms on first use. Describe the purpose of each setup command and its expected result. Avoid invented UI button names and unsupported guarantees.'],
  ]},
  { name: 'אבטחה', entries: [
    ['auth-review', 'סקירת הרשאות', 'SKILL', 'בדיקת מסלולים מוגנים והפרדה בין משתמשים.', 'Map public, authenticated and administrator routes. Check that identity comes from verified authentication. Look for cross-user access and role escalation. Report findings without exposing credentials.'],
    ['secret-handling', 'שמירת סודות', 'RULE', 'הנחיות למניעת חשיפת סיסמאות ומפתחות.', 'Never print real tokens, passwords or connection strings. Keep secrets in environment configuration. Redact sensitive fields from logs. Do not add .env files to version control.'],
    ['input-review', 'סקירת קלט', 'SKILL', 'בדיקת גבולות אורך, שדות חובה וקובצי העלאה.', 'Inspect input validation and upload limits. Verify that unknown sensitive fields are rejected. Check file size and supported content. Do not execute untrusted uploads. Propose concrete tests.'],
  ]},
  { name: 'נתונים', entries: [
    ['database-plan', 'תכנון נתונים', 'SKILL', 'מיפוי ישויות וקשרים מתוך צורך עסקי מוגדר.', 'Identify entities, ownership and lifecycle from the stated requirements. Propose primary keys, foreign keys and uniqueness constraints. Keep the model small and explain the purpose of every table.'],
    ['migration-rules', 'כללי Migrations', 'RULE', 'כללים לשינויים מבוקרים במבנה מסד הנתונים.', 'Use versioned migrations for schema changes. Inspect generated SQL before applying it. Never reset production data. Report backup and rollback considerations before a destructive change.'],
    ['seed-review', 'בדיקת נתוני הדגמה', 'SKILL', 'בדיקת נתונים בדויים ואתחול שניתן לחזור עליו.', 'Check that demo data is fictional and useful for filters and permissions. Ensure repeated seeding does not duplicate or overwrite user edits. Do not use publicly known production passwords.'],
  ]},
  { name: 'פרודוקטיביות', entries: [
    ['task-breakdown', 'פירוק משימה', 'SKILL', 'חלוקת עבודה גדולה לצעדים קטנים שניתנים לבדיקה.', 'Identify the requested outcome and constraints. Break the task into small verifiable steps. Prioritize required behavior over optional features. Call out missing information only when it blocks progress.'],
    ['scope-control', 'שמירה על היקף', 'RULE', 'מיקוד בדרישות המאושרות ללא הרחבות מיותרות.', 'Follow the approved scope. Do not add unrelated features or dependencies. Record useful future improvements separately. Prefer a complete small workflow to an unfinished broad implementation.'],
    ['handoff', 'הכנת מסירה', 'SKILL', 'סיכום קבצים, הוראות הפעלה ותוצאות בדיקות אמיתיות.', 'List deliverables and exact startup commands. Separate completed work, verified checks and remaining limitations. Check the archive excludes secrets and dependency folders. Never invent test results.'],
  ]},
] as const;

export const seedSchema = z.object({
  adminEmail: emailSchema, adminPassword: passwordSchema,
  userEmail: emailSchema, userPassword: passwordSchema,
}).refine(v => v.adminEmail !== v.userEmail, 'נדרשים חשבונות נפרדים');

export async function seedDatabase(input: z.infer<typeof seedSchema>) {
  const config = seedSchema.parse(input);
  const accounts = [
    { email: config.adminEmail, password: config.adminPassword, role: 'ADMIN' as const, displayName: 'מנהלת ההדגמה' },
    { email: config.userEmail, password: config.userPassword, role: 'USER' as const, displayName: 'משתמשת ההדגמה' },
  ];
  const prepared = await Promise.all(accounts.map(async account => ({ ...account, passwordHash: await bcrypt.hash(account.password, 12) })));
  await db.$transaction(async tx => {
    let createdDemoUser = false;
    for (const account of prepared) {
      const existing = await tx.user.findUnique({ where: { email: account.email } });
      if (existing && existing.role !== account.role) throw new Error('Seed account already exists with a different role; choose a different seed email.');
      if (!existing && account.role === 'USER') createdDemoUser = true;
      await tx.user.upsert({ where: { email: account.email }, update: {}, create: {
        email: account.email, displayName: account.displayName, passwordHash: account.passwordHash, role: account.role,
      } });
    }
    for (const group of groups) {
      const categoryId = stableId(`category:${group.name}`);
      await tx.category.upsert({ where: { id: categoryId }, update: {}, create: { id: categoryId, name: group.name } });
      for (const [slug, title, type, description, instructions] of group.entries) {
        const skill = type === 'SKILL';
        const text = skill
          ? `---\nname: ${slug}\ndescription: ${description}\n---\n\n# ${title}\n\n${instructions}\n`
          : `# ${title}\n\n${instructions}\n`;
        const file = Buffer.from(text, 'utf8');
        await tx.resource.upsert({ where: { id: stableId(`resource:${slug}`) }, update: {}, create: {
          id: stableId(`resource:${slug}`), title, description, type, categoryId, supportedTool: 'Claude Code',
          usageInstructions: skill
            ? `לאחר ההורדה יש ליצור בפרויקט תיקייה .claude/skills/${slug}/ ולשמור בה את הקובץ בשם SKILL.md. יש לעיין בתוכן לפני השימוש. ההפעלה והזמינות תלויות בגרסת Claude Code ובהרשאות הכלי. אין התקנה אוטומטית באתר.`
            : `לאחר ההורדה יש לשמור את הקובץ בתיקיית .claude/rules/ בפרויקט. יש לעיין בתוכן ולהתאימו לצורך. טעינת הכללים תלויה בגרסת Claude Code. אין התקנה אוטומטית באתר.`,
          fileName: skill ? 'SKILL.md' : `${slug}.md`, fileData: new Uint8Array(file), fileSize: file.length,
          mimeType: 'text/plain; charset=utf-8',
        } });
      }
    }
    const user = await tx.user.findUniqueOrThrow({ where: { email: config.userEmail } });
    for (const slug of createdDemoUser ? ['typescript', 'readme', 'test-plan'] : []) {
      const resourceId = stableId(`resource:${slug}`);
      await tx.favorite.upsert({ where: { userId_resourceId: { userId: user.id, resourceId } }, update: {}, create: { userId: user.id, resourceId } });
    }
  }, { timeout: 20000 });
  return { categories: groups.length, resources: groups.reduce((sum, group) => sum + group.entries.length, 0) };
}
