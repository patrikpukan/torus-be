import { Injectable, ConflictException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/core/prisma/prisma.service";
import { CreateDepartmentInput, UpdateDepartmentInput, DeleteDepartmentInput } from "../graphql/types/department-input.type";

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  async createDepartment(input: CreateDepartmentInput): Promise<any> {
    // Verify organization exists
    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
    });

    if (!organization) {
      throw new NotFoundException("Organization not found");
    }

    // Check if department name already exists in this organization
    const existingDept = await this.prisma.department.findFirst({
      where: {
        organizationId: input.organizationId,
        name: input.name.trim(),
      },
    });

    if (existingDept) {
      throw new ConflictException(
        `Department with name '${input.name.trim()}' already exists in this organization`
      );
    }

    // Create department
    const department = await this.prisma.department.create({
      data: {
        name: input.name.trim(),
        description: input.description ? input.description.trim() : null,
        organizationId: input.organizationId,
      },
    });

    return department;
  }

  async updateDepartment(input: UpdateDepartmentInput): Promise<any> {
    // Find existing department
    const existingDept = await this.prisma.department.findUnique({
      where: { id: input.id },
    });

    if (!existingDept) {
      throw new NotFoundException("Department not found");
    }

    // Check if new name conflicts with another department in same organization
    if (input.name.trim() !== existingDept.name) {
      const conflictingDept = await this.prisma.department.findFirst({
        where: {
          organizationId: existingDept.organizationId,
          name: input.name.trim(),
          id: { not: input.id }, // Exclude current department
        },
      });

      if (conflictingDept) {
        throw new ConflictException(
          `Department with name '${input.name.trim()}' already exists`
        );
      }
    }

    // Update department
    const department = await this.prisma.department.update({
      where: { id: input.id },
      data: {
        name: input.name.trim(),
        description: input.description ? input.description.trim() : null,
      },
    });

    return department;
  }

  async deleteDepartment(input: DeleteDepartmentInput): Promise<boolean> {
    // Find department by id AND organizationId (security check)
    const department = await this.prisma.department.findFirst({
      where: {
        id: input.id,
        organizationId: input.organizationId,
      },
    });

    if (!department) {
      throw new NotFoundException(
        "Department not found or does not belong to your organization"
      );
    }

    // Delete department (users will auto-set to null via schema cascade)
    await this.prisma.department.delete({
      where: { id: input.id },
    });

    return true;
  }

  async getDepartmentsByOrganization(organizationId: string): Promise<any[]> {
    const departments = await this.prisma.department.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    return departments;
  }

  async getDepartmentById(id: string): Promise<any | null> {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    return department;
  }

  async getUsersByDepartment(departmentId: string): Promise<any[]> {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            profileImageUrl: true,
            role: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException("Department not found");
    }

    return department.users;
  }

  async canManageDepartments(
    userId: string,
    organizationId: string
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return false;
    }

    // Super admin can manage all departments
    if (user.role === "super_admin") {
      return true;
    }

    // Org admin can manage departments in their organization
    if (user.role === "org_admin" && user.organizationId === organizationId) {
      return true;
    }

    return false;
  }
}
