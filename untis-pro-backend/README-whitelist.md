# Whitelist Configuration

This file controls which users and classes can register for new accounts during the closed beta period.

## Setup

1. Copy this file to `whitelist.json` in the same directory
2. Set `WHITELIST_ENABLED=true` in your `.env` file
3. Customize the usernames and classes below as needed

## Configuration

The JSON structure supports two types of access control:

### Username-based access
Add specific usernames to allow individual users:

```json
{
  "usernames": [
    "student1",
    "student2",
    "teacher123"
  ]
}
```

### Class-based access
Add class/grade names to allow entire classes:

```json
{
  "classes": [
    "10A",
    "10B", 
    "11A",
    "12Math"
  ]
}
```

### Combined access
You can use both username and class-based access together. A user will be allowed if they match either condition:

```json
{
  "usernames": [
    "specialuser1",
    "admin123"
  ],
  "classes": [
    "10A",
    "11B"
  ]
}
```

## Notes

- Each username and class name should be on its own line for easy editing
- Existing users in the database will continue to work (grandfathered in)
- Admin users bypass the whitelist completely
- If the whitelist.json file doesn't exist, the whitelist is effectively disabled
- Changes to this file require a server restart to take effect