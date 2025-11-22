import {
  Args,
  Context,
  Mutation,
  Query,
  Resolver,
  ResolveField,
  Parent,
} from "@nestjs/graphql";
import { UseGuards, ForbiddenException } from "@nestjs/common";
import { DepartmentType } from "../types/department.type";
import { DepartmentService } from "../../services/department.service";
import { CreateDepartmentInput, UpdateDepartmentInput, DeleteDepartmentInput } from "../types/department-input.type";
import { AuthenticatedUserGuard } from "src/shared/auth/guards/authenticated-user.guard";
import { PrismaService } from "src/core/prisma/prisma.service";

@Resolver(() => DepartmentType)
export class DepartmentResolver {
  constructor(
    private readonly departmentService: DepartmentService,
    private readonly prisma: PrismaService
  ) {}

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => DepartmentType)
  async createDepartment(
    @Args("input") input: CreateDepartmentInput,
    @Context() context: any
  ): Promise<any> {
    const userId = context.req.user.id;

    // Check authorization
    const canManage = await this.departmentService.canManageDepartments(
      userId,
      input.organizationId
    );

    if (!canManage) {
      throw new ForbiddenException(
        "You do not have permission to manage departments in this organization"
      );
    }

    return this.departmentService.createDepartment(input);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => DepartmentType)
  async updateDepartment(
    @Args("input") input: UpdateDepartmentInput,
    @Context() context: any
  ): Promise<any> {
    const userId = context.req.user.id;

    // Get department to find its organization
    const department = await this.departmentService.getDepartmentById(input.id);

    if (!department) {
      throw new ForbiddenException("Department not found");
    }

    // Check authorization
    const canManage = await this.departmentService.canManageDepartments(
      userId,
      department.organizationId
    );

    if (!canManage) {
      throw new ForbiddenException(
        "You do not have permission to edit this department"
      );
    }

    return this.departmentService.updateDepartment(input);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Mutation(() => Boolean)
  async deleteDepartment(
    @Args("input") input: DeleteDepartmentInput,
    @Context() context: any
  ): Promise<boolean> {
    const userId = context.req.user.id;

    // Check authorization
    const canManage = await this.departmentService.canManageDepartments(
      userId,
      input.organizationId
    );

    if (!canManage) {
      throw new ForbiddenException(
        "You do not have permission to delete departments in this organization"
      );
    }

    return this.departmentService.deleteDepartment(input);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => [DepartmentType])
  async getDepartmentsByOrganization(
    @Args("organizationId") organizationId: string,
    @Context() context: any
  ): Promise<any[]> {
    const userId = context.req.user.id;

    // Get user to check role and organization
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ForbiddenException("User not found");
    }

    // Authorization: super admin can view all, others only their organization
    if (user.role !== "super_admin" && user.organizationId !== organizationId) {
      throw new ForbiddenException(
        "You do not have permission to view departments for this organization"
      );
    }

    return this.departmentService.getDepartmentsByOrganization(organizationId);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => DepartmentType, { nullable: true })
  async getDepartmentById(@Args("id") id: string): Promise<any | null> {
    return this.departmentService.getDepartmentById(id);
  }

  @UseGuards(AuthenticatedUserGuard)
  @Query(() => [DepartmentType])
  async getUsersByDepartment(
    @Args("departmentId") departmentId: string
  ): Promise<any[]> {
    return this.departmentService.getUsersByDepartment(departmentId);
  }

  @ResolveField(() => Number)
  async employeeCount(@Parent() department: any): Promise<number> {
    if (department._count && department._count.users !== undefined) {
      return department._count.users;
    }

    // Fallback: query users if count not included
    const users = await this.departmentService.getUsersByDepartment(
      department.id
    );
    return users.length;
  }
}
