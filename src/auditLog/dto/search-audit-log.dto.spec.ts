import "reflect-metadata";
import { validate, ValidationError } from "class-validator";
import { plainToInstance } from "class-transformer";
import { SearchAuditLogDto } from "./search-audit-log.dto";

describe("SearchAuditLogDto", () => {
  let dto: SearchAuditLogDto;

  beforeEach(() => {
    dto = new SearchAuditLogDto();
  });

  describe("Default values", () => {
    it("should have default page value of 1", () => {
      expect(dto.page).toBe(1);
    });

    it("should have default limit value of 10", () => {
      expect(dto.limit).toBe(10);
    });

    it("should have undefined values for other fields", () => {
      expect(dto.query).toBeUndefined();
      expect(dto.eventType).toBeUndefined();
      expect(dto.startDate).toBeUndefined();
      expect(dto.endDate).toBeUndefined();
      expect(dto.userId).toBeUndefined();
    });
  });

  describe("Validations", () => {
    it("should pass validation with default values", async () => {
      const errors: ValidationError[] = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it("should pass validation with valid values for all fields", async () => {
      dto.page = 2;
      dto.limit = 20;
      dto.query = "test query";
      dto.eventType = "CREATE";
      dto.startDate = "2023-01-01T00:00:00Z";
      dto.endDate = "2023-01-31T23:59:59Z";
      dto.userId = "user123";

      const errors: ValidationError[] = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it("should fail validation when page is less than 1", async () => {
      dto.page = 0; // Explicitly set as number since we know it's not undefined
      const errors: ValidationError[] = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty("min");
    });

    it("should fail validation when limit is less than 1", async () => {
      dto.limit = 0; // Explicitly set as number since we know it's not undefined
      const errors: ValidationError[] = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty("min");
    });

    it("should fail validation when page is not an integer", async () => {
      // Using type conversion to bypass TypeScript's type checking
      dto.page = 1.5 as any;
      const errors: ValidationError[] = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty("isInt");
    });

    it("should fail validation when limit is not an integer", async () => {
      // Using type conversion to bypass TypeScript's type checking
      dto.limit = 1.5 as any;
      const errors: ValidationError[] = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty("isInt");
    });

    it("should fail validation when startDate is not a valid date string", async () => {
      dto.startDate = "invalid-date";
      const errors: ValidationError[] = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty("isDateString");
    });

    it("should fail validation when endDate is not a valid date string", async () => {
      dto.endDate = "invalid-date";
      const errors: ValidationError[] = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty("isDateString");
    });
  });

  describe("Type transformation", () => {
    it("should transform string values to numbers for page and limit", async () => {
      const plainObject = {
        page: "2",
        limit: "20",
      };

      const transformed = plainToInstance(SearchAuditLogDto, plainObject);

      expect(transformed.page).toBe(2);
      expect(typeof transformed.page).toBe("number");

      expect(transformed.limit).toBe(20);
      expect(typeof transformed.limit).toBe("number");

      const errors: ValidationError[] = await validate(transformed);
      expect(errors.length).toBe(0);
    });

    it("should fail validation when transformed page is not a valid number", async () => {
      const plainObject = {
        page: "not-a-number",
      };

      const transformed = plainToInstance(SearchAuditLogDto, plainObject);

      // The transformation will result in NaN, which is still a number type
      expect(typeof transformed.page).toBe("number");

      // Check if the value is NaN in a TypeScript-friendly way
      if (transformed.page !== undefined) {
        expect(Number.isNaN(transformed.page)).toBe(true);
      }

      const errors: ValidationError[] = await validate(transformed);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty("isInt");
    });

    it("should fail validation when transformed limit is not a valid number", async () => {
      const plainObject = {
        limit: "not-a-number",
      };

      const transformed = plainToInstance(SearchAuditLogDto, plainObject);

      // The transformation will result in NaN, which is still a number type
      expect(typeof transformed.limit).toBe("number");

      // Check if the value is NaN in a TypeScript-friendly way
      if (transformed.limit !== undefined) {
        expect(Number.isNaN(transformed.limit)).toBe(true);
      }

      const errors: ValidationError[] = await validate(transformed);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty("isInt");
    });
  });

  describe("Optional fields", () => {
    it("should pass validation when optional fields are undefined", async () => {
      const plainObject = {};
      const transformed = plainToInstance(SearchAuditLogDto, plainObject);

      expect(transformed.page).toBe(1);
      expect(transformed.limit).toBe(10);
      expect(transformed.query).toBeUndefined();
      expect(transformed.eventType).toBeUndefined();
      expect(transformed.startDate).toBeUndefined();
      expect(transformed.endDate).toBeUndefined();
      expect(transformed.userId).toBeUndefined();

      const errors: ValidationError[] = await validate(transformed);
      expect(errors.length).toBe(0);
    });

    it("should pass validation when optional fields are null", async () => {
      const plainObject = {
        query: null,
        eventType: null,
        startDate: null,
        endDate: null,
        userId: null,
      };

      const transformed = plainToInstance(SearchAuditLogDto, plainObject);

      const errors: ValidationError[] = await validate(transformed);
      expect(errors.length).toBe(0);
    });
  });

  describe("Combination tests", () => {
    it("should validate a mix of valid and invalid fields correctly", async () => {
      const plainObject = {
        page: "3",
        limit: "-5",
        query: "test",
        eventType: 123,
        startDate: "2023-01-01T00:00:00Z",
        endDate: "invalid-date",
      };

      const transformed = plainToInstance(SearchAuditLogDto, plainObject);
      const errors: ValidationError[] = await validate(transformed);

      expect(errors.length).toBe(3);

      const limitError = errors.find((e) => e.property === "limit");
      expect(limitError).toBeDefined();
      if (limitError) {
        expect(limitError.constraints).toHaveProperty("min");
      }

      const endDateError = errors.find((e) => e.property === "endDate");
      expect(endDateError).toBeDefined();
      if (endDateError) {
        expect(endDateError.constraints).toHaveProperty("isDateString");
      }
    });
  });
});
