# Coding Standards & Guidelines

## 1. General Principles
- **Clarity over Cleverness**: Write readable, maintainable, and self-documenting code.
- **Explicit Error Handling**: Errors must be explicitly checked, wrapped with context, and never swallowed silently.
- **No Unused Code**: Avoid dead code, commented-out logic, or unused imports.

## 2. Go Standards (`services/api`, `services/worker`)
- Follow standard Go formatting (`gofmt`, `go vet`).
- **Error Handling**: Always handle `error` return values. Wrap errors using `fmt.Errorf("context: %w", err)`.
- **Concurrency**: Protect shared resources with appropriate mutexes or channel communication. Avoid naked goroutines; use worker pools and context cancellation.
- **Database Access**: Use `sqlc` generated queries and `pgx` type safety. Never concatenate raw SQL strings.

## 3. TypeScript & React Standards (`apps/web`)
- Enforce strict TypeScript typing (`strict: true`). Avoid `any`; use precise domain interfaces or `unknown`.
- Use React Functional Components with hooks.
- State management must remain localized to components or custom hooks unless global session state is required.
- Tailwind CSS styling must use consistent design tokens and layout classes. Avoid arbitrary hardcoded pixel inline styles.

## 4. Python Standards (`services/intelligence`)
- Enforce PEP 8 formatting and type hints (MyPy standard).
- FastAPIs must declare explicit Pydantic schemas for request and response models.
- Dataframe manipulations with `pandas` must avoid inplace mutations where possible and validate schema/types explicitly.

## 5. Naming Conventions
- **Go**: `camelCase` for internal fields/variables, `PascalCase` for exported entities.
- **TypeScript**: `camelCase` for variables/functions, `PascalCase` for components/types/interfaces, `kebab-case` for files/folders.
- **Python**: `snake_case` for variables/functions/files, `PascalCase` for classes.
- **Database**: `snake_case` for tables, columns, constraints, and indexes. Pluralized table names (e.g. `journal_entries`).
