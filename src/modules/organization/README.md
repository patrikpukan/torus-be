# Organization Registration Feature

## Overview
This feature allows new organizations to register through a self-service flow. When an organization is registered, an admin user is automatically created and receives an email invitation to set up their password.

## Flow

1. **User fills out the registration form** (`/register-org`)
   - Administrator email
   - Organization name
   - Organization size (employee count range)
   - Organization address

2. **Backend processes the registration**
   - Validates that email is unique
   - Generates organization code from name
   - Creates organization in database
   - Creates Supabase auth user (without password)
   - Creates user record in our database with `org_admin` role
   - Links user to organization

3. **Supabase sends invitation email**
   - When a user is created with `email_confirm: false`, Supabase automatically sends a confirmation email
   - The email contains a link for the user to verify their email and set their password

4. **Admin completes setup**
   - Clicks link in email
   - Sets their password
   - Can now log in to the system

## Backend Implementation

### Module Structure
```
src/modules/organization/
├── domain/
│   └── organization.ts           # Domain types
├── graphql/
│   ├── resolvers/
│   │   └── organization.resolver.ts
│   └── types/
│       ├── organization.type.ts
│       ├── register-organization-input.type.ts
│       └── register-organization-response.type.ts
├── repositories/
│   └── organization.repository.ts
├── services/
│   └── organization.service.ts
└── organization.module.ts
```

### GraphQL API

**Mutation: `registerOrganization`**

```graphql
mutation RegisterOrganization($input: RegisterOrganizationInputType!) {
  registerOrganization(input: $input) {
    organization {
      id
      name
      code
      size
      address
      createdAt
      updatedAt
    }
    adminEmail
    message
  }
}
```

**Input:**
```typescript
{
  adminEmail: string;
  organizationName: string;
  organizationSize: string; // "1-10", "11-50", "51-200", "201-500", "501+"
  organizationAddress: string;
}
```

## Frontend Implementation

### Components
- `CreateOrganizationForm` - Form component with validation
- Located at: `src/features/organization/components/CreateOrganizationForm.tsx`

### API Hook
- `useRegisterOrganization` - GraphQL mutation hook
- Located at: `src/features/organization/api/useRegisterOrganization.ts`

### Form Fields
- **Administrator Email** - Required, validated email format
- **Organization Name** - Required, min 3 characters
- **Organization Size** - Required, dropdown selection
- **Organization Address** - Required, min 10 characters

### Success Flow
After successful registration:
1. Success message is displayed
2. User is redirected to login page after 3 seconds
3. Admin receives email invitation

## Supabase Configuration

### Environment Variables
Ensure these are set in `.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
```

### Email Templates
Supabase will use its default email confirmation template. To customize:
1. Go to Supabase Dashboard → Authentication → Email Templates
2. Edit the "Confirm signup" template
3. Customize the message for organization admins

### Auth Settings
- Email confirmation is required (`email_confirm: false` in createUser)
- Users must verify email before setting password
- Password requirements can be configured in Supabase dashboard

## Database Schema

### Organization Table
```prisma
model Organization {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  code      String   @unique
  size      Int?
  address   String?
  imageUrl  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  users     User[]
  // ... other relations
}
```

### User Table (relevant fields)
```prisma
model User {
  id              String       @id @db.Uuid
  organizationId  String       @db.Uuid
  organization    Organization @relation(fields: [organizationId], references: [id])
  email           String       @unique
  emailVerified   Boolean
  role            UserRole     @default(user)
  supabaseUserId  String?      @unique
  // ... other fields
}
```

### User Roles
- `user` - Regular organization member
- `org_admin` - Organization administrator
- `super_admin` - System administrator

## Testing

### Manual Testing Steps
1. Navigate to `/register-org`
2. Fill out the form with valid data
3. Submit the form
4. Check that success message appears
5. Check admin email inbox for invitation
6. Click link in email
7. Set password
8. Log in with new credentials

### Error Cases to Test
- Duplicate email address
- Duplicate organization name
- Invalid email format
- Missing required fields
- Network errors

## Security Considerations

- No password is sent via the registration form
- User must verify email before accessing system
- Organization code is generated server-side
- Supabase handles secure password reset links
- All mutations validate input data

## Future Enhancements

- [ ] Email template customization for organization invitations
- [ ] Organization logo upload during registration
- [ ] Email domain verification for organization
- [ ] Admin approval workflow for organization registration
- [ ] Bulk user import for organizations
- [ ] Custom email sender configuration per organization
