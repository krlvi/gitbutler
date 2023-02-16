use crate::storage;
use crate::users::user;
use anyhow::Result;

const USER_FILE: &str = "user.json";

pub struct Storage<'a> {
    storage: &'a storage::Storage,
}

impl<'a> Storage<'a> {
    pub fn new(storage: &'a storage::Storage) -> Self {
        Self { storage }
    }

    pub fn get(&self) -> Result<Option<user::User>> {
        match self.storage.read(USER_FILE)? {
            Some(data) => Ok(Some(serde_json::from_str(&data)?)),
            None => Ok(None),
        }
    }

    pub fn set(&self, user: &user::User) -> Result<()> {
        let data = serde_json::to_string(user)?;
        self.storage.write(USER_FILE, &data)?;
        Ok(())
    }

    pub fn delete(&self) -> Result<()> {
        self.storage.delete(USER_FILE)?;
        Ok(())
    }
}
