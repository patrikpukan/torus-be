import { randomUUID } from "crypto";
import { PrismaService } from "../../../core/prisma/prisma.service";

interface DepartmentDefinition {
  name: string;
  description: string;
}

const DEPARTMENT_DEFINITIONS: DepartmentDefinition[] = [
  {
    name: "Engineering",
    description:
      "Software engineering, architecture, and technology infrastructure",
  },
  {
    name: "Product",
    description: "Product management, strategy, and roadmap development",
  },
  {
    name: "Marketing",
    description: "Marketing, communications, and brand management initiatives",
  },
  {
    name: "Sales",
    description: "Sales operations, account management, and revenue growth",
  },
  {
    name: "Human Resources",
    description: "HR, recruitment, and employee development programs",
  },
  {
    name: "Finance",
    description: "Financial planning, accounting, and fiscal management",
  },
  {
    name: "Operations",
    description: "Operations management and business process optimization",
  },
  {
    name: "Customer Support",
    description: "Customer service, technical support, and success management",
  },
];

export async function createDepartments(
  prisma: PrismaService,
  organizationId: string
): Promise<string[]> {
  const db = prisma as any;
  const departmentIds: string[] = [];

  console.log(
    `\nCreating ${DEPARTMENT_DEFINITIONS.length} departments for organization...`
  );

  for (const deptDef of DEPARTMENT_DEFINITIONS) {
    try {
      // Check if department already exists
      const existingDept = await db.department.findFirst({
        where: {
          organizationId,
          name: deptDef.name,
        },
      });

      if (existingDept) {
        console.log(`  ✓ Department already exists: ${deptDef.name}`);
        departmentIds.push(existingDept.id);
      } else {
        // Create new department
        const newDept = await db.department.create({
          data: {
            id: randomUUID(),
            name: deptDef.name,
            description: deptDef.description,
            organizationId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        console.log(`  ✓ Created department: ${deptDef.name}`);
        departmentIds.push(newDept.id);
      }
    } catch (error) {
      console.error(`  ✗ Error processing department ${deptDef.name}:`, error);
      throw error;
    }
  }

  console.log(`Successfully processed ${departmentIds.length} departments.\n`);
  return departmentIds;
}
