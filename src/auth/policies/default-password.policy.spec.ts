import { DefaultPasswordPolicy } from "../policies/default-password.policy";
import { BadRequestException } from "@nestjs/common";

describe("DefaultPasswordPolicy", () => {
  let policy: DefaultPasswordPolicy;

  beforeEach(() => {
    policy = new DefaultPasswordPolicy();
  });

  it("should not throw for a valid password", () => {
    expect(() => policy.validate("Valid1!A")).not.toThrow();
  });

  it("should throw when password is too short", () => {
    expect(() => policy.validate("Aa1!")).toThrow(BadRequestException);
    try {
      policy.validate("Aa1!");
    } catch (e) {
      if (e instanceof BadRequestException) {
        const response = e.getResponse() as { errors: string[] };
        expect(response.errors).toContain(
          "Password must be at least 8 characters long",
        );
      } else {
        throw e;
      }
    }
  });

  it("should throw when missing lowercase letter", () => {
    expect(() => policy.validate("VALID1!A")).toThrow(BadRequestException);
    try {
      policy.validate("VALID1!A");
    } catch (e) {
      const response = (e as BadRequestException).getResponse() as {
        errors: string[];
      };
      expect(response.errors).toContain(
        "Password must include at least one lowercase letter",
      );
    }
  });

  it("should throw when missing uppercase letter", () => {
    expect(() => policy.validate("valid1!a")).toThrow(BadRequestException);
    try {
      policy.validate("valid1!a");
    } catch (e) {
      const response = (e as BadRequestException).getResponse() as {
        errors: string[];
      };
      expect(response.errors).toContain(
        "Password must include at least one uppercase letter",
      );
    }
  });

  it("should throw when missing number", () => {
    expect(() => policy.validate("Valid!Aa")).toThrow(BadRequestException);
    try {
      policy.validate("Valid!Aa");
    } catch (e) {
      const response = (e as BadRequestException).getResponse() as {
        errors: string[];
      };
      expect(response.errors).toContain(
        "Password must include at least one number",
      );
    }
  });

  it("should throw when missing special character", () => {
    expect(() => policy.validate("Valid1Aa")).toThrow(BadRequestException);
    try {
      policy.validate("Valid1Aa");
    } catch (e) {
      const response = (e as BadRequestException).getResponse() as {
        errors: string[];
      };
      expect(response.errors).toContain(
        "Password must include at least one special character",
      );
    }
  });

  it("should throw with multiple errors for a very weak password", () => {
    expect(() => policy.validate("short")).toThrow(BadRequestException);
    try {
      policy.validate("short");
    } catch (e) {
      const response = (e as BadRequestException).getResponse() as {
        errors: string[];
      };
      expect(response.errors).toContain(
        "Password must be at least 8 characters long",
      );
      expect(response.errors).toContain(
        "Password must include at least one uppercase letter",
      );
      expect(response.errors).toContain(
        "Password must include at least one number",
      );
      expect(response.errors).toContain(
        "Password must include at least one special character",
      );
    }
  });
});
