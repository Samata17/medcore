import { Transform } from "class-transformer";
import { IsDateString, IsEmail, IsString, IsUUID, Length, Matches, MaxLength, MinLength } from "class-validator";

const lower = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toLowerCase() : value);
const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

/** Same policy as the frontend: 8–72 chars (bcrypt limit), upper, lower, number. */
const PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;
const PASSWORD_MSG = "Password must be 8–72 characters with uppercase, lowercase and a number";

export class LoginDto {
  @Transform(lower) @IsEmail() @MaxLength(120) email: string;
  @IsString() @MinLength(1) @MaxLength(72) password: string;
}

export class RegisterDto {
  @Transform(trim) @IsString() @Length(2, 50) firstName: string;
  @Transform(trim) @IsString() @Length(1, 50) lastName: string;
  @Transform(lower) @IsEmail() @MaxLength(120) email: string;
  @Transform(trim) @Matches(/^\+?[0-9]{10,14}$/, { message: "Enter a valid phone number (10–14 digits)" }) phone: string;
  @IsDateString() dateOfBirth: string;
  @Matches(PASSWORD, { message: PASSWORD_MSG }) password: string;
  /** The hospital where the patient wants to receive care. */
  @IsUUID() hospitalId: string;
}

export class EmailDto {
  @Transform(lower) @IsEmail() @MaxLength(120) email: string;
}

export class VerifyEmailDto extends EmailDto {
  @Matches(/^\d{6}$/, { message: "Enter the 6-digit code" }) otp: string;
}

export class ResetPasswordDto extends VerifyEmailDto {
  @Matches(PASSWORD, { message: PASSWORD_MSG }) password: string;
}
