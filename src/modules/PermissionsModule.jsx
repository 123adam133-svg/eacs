import React from 'react';
import PermissionManager from '../components/PermissionManager';

export function PermissionsModule({ roles = [], setRoles, setSyncStatus }) {
  return (
    <PermissionManager
      roles={roles}
      setRoles={setRoles}
      setSyncStatus={setSyncStatus}
    />
  );
}

export default PermissionsModule;
