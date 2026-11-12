import { Body, Controller, Get, Module, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, Length, Matches, MaxLength } from "class-validator";
import type { RequestUser } from "../../common/auth-types";
import { CurrentUser } from "../../common/decorators";
import { PrismaService } from "../../prisma/prisma.service";
import { toAuthUser } from "../auth/auth.service";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

class UpdateProfileDto {
  @Transform(trim) @IsString() @Length(2, 50) firstName: string;
  @Transform(trim) @IsString() @Length(1, 50) lastName: string;
  @Transform(trim) @Matches(/^\+?[0-9]{10,14}$/, { message: "Enter a valid phone number (10–14 digits)" }) phone: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) addressLine1?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) city?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) state?: string;
  @IsOptional() @Transform(trim) @Matches(/^$|^[0-9]{6}$/, { message: "Enter a 6-digit PIN code" }) postalCode?: string;
}

@ApiTags("Users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("me")
  async me(@CurrentUser() user: RequestUser) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { address: true, hospital: { select: { name: true } } } });
    return { ...toAuthUser(u), phone: u.phone, address: u.address };
  }

  /** Any signed-in user can update their own name, phone and address. Email and role can't be changed here. */
  @Patch("me")
  async update(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    const hasAddress = dto.addressLine1 && dto.city && dto.state && dto.postalCode;
    const u = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        ...(hasAddress
          ? {
              address: {
                upsert: {
                  create: { line1: dto.addressLine1!, city: dto.city!, state: dto.state!, postalCode: dto.postalCode! },
                  update: { line1: dto.addressLine1!, city: dto.city!, state: dto.state!, postalCode: dto.postalCode! },
                },
              },
            }
          : {}),
      },
      include: { hospital: { select: { name: true } } },
    });
    return toAuthUser(u);
  }
}

@Module({ controllers: [UsersController] })
export class UsersModule {}
