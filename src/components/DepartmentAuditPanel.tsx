import { useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import {
  auditAllDepartments,
  exportAuditToCSV,
  printAuditToConsole,
  findEmptyDepartments,
  findUnderstaffedDepartments,
  findCrossFunctionalStaff,
  type AuditSummary,
} from '../utils/departmentAudit';

/**
 * Department Audit Panel
 *
 * Shows comprehensive audit of all fields/departments and their members.
 * Can be integrated into Settings → Department Audit page.
 */
export function DepartmentAuditPanel() {
  const { jobRoles, users, roleAssignments } = useAppData();
  const [auditData, setAuditData] = useState<AuditSummary | null>(null);

  const generateAudit = () => {
    const summary = auditAllDepartments(jobRoles, users, roleAssignments);
    setAuditData(summary);
    printAuditToConsole(summary); // Also print to console
  };

  const downloadCSV = () => {
    if (!auditData) return;
    const csv = exportAuditToCSV(auditData);
    const element = document.createElement('a');
    element.setAttribute(
      'href',
      `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`,
    );
    element.setAttribute('download', `department_audit_${new Date().toISOString().split('T')[0]}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="department-audit-panel" style={{ padding: '20px' }}>
      <h2>Department/Field Audit</h2>
      <p>
        Generate a comprehensive report of all fields/departments and their member assignments.
      </p>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          onClick={generateAudit}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Generate Audit Report
        </button>
        {auditData && (
          <button
            onClick={downloadCSV}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Download as CSV
          </button>
        )}
      </div>

      {auditData && (
        <>
          {/* Summary Stats */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px',
              marginBottom: '30px',
            }}
          >
            <StatCard
              label="Total Departments"
              value={auditData.totalDepartments}
            />
            <StatCard
              label="Departments with Members"
              value={auditData.departmentsWithMembers}
              color="#28a745"
            />
            <StatCard
              label="Empty Departments"
              value={auditData.departmentsEmpty}
              color={auditData.departmentsEmpty > 0 ? '#ffc107' : '#ccc'}
            />
            <StatCard
              label="Total Staff Assignments"
              value={auditData.totalStaffAssignments}
            />
            <StatCard
              label="Unique Staff Members"
              value={auditData.totalUniqueStaffMembers}
            />
          </div>

          {/* Empty Departments Alert */}
          {findEmptyDepartments(auditData).length > 0 && (
            <div
              style={{
                backgroundColor: '#fff3cd',
                border: '1px solid #ffc107',
                padding: '15px',
                marginBottom: '20px',
                borderRadius: '4px',
              }}
            >
              <strong>⚠️ Empty Departments:</strong>
              <ul style={{ marginTop: '10px', marginBottom: 0 }}>
                {findEmptyDepartments(auditData).map((dept) => (
                  <li key={dept.departmentId}>{dept.departmentName}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Understaffed Alert */}
          {findUnderstaffedDepartments(auditData, 2).length > 0 && (
            <div
              style={{
                backgroundColor: '#f8d7da',
                border: '1px solid #f5c6cb',
                padding: '15px',
                marginBottom: '20px',
                borderRadius: '4px',
              }}
            >
              <strong>⚠️ Understaffed Departments (1 member):</strong>
              <ul style={{ marginTop: '10px', marginBottom: 0 }}>
                {findUnderstaffedDepartments(auditData, 2).map((dept) => (
                  <li key={dept.departmentId}>
                    {dept.departmentName} ({dept.totalMembers} member)
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cross-functional Staff */}
          {findCrossFunctionalStaff(jobRoles, users, roleAssignments)
            .length > 0 && (
            <div
              style={{
                backgroundColor: '#d1ecf1',
                border: '1px solid #bee5eb',
                padding: '15px',
                marginBottom: '20px',
                borderRadius: '4px',
              }}
            >
              <strong>👥 Cross-functional Staff:</strong>
              <ul style={{ marginTop: '10px', marginBottom: 0 }}>
                {findCrossFunctionalStaff(jobRoles, users, roleAssignments).map(
                  (staff) => (
                    <li key={staff.user.id}>
                      {staff.user.displayName} works in {staff.count} departments:{' '}
                      {staff.departments.join(', ')}
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}

          {/* Department Details Table */}
          <h3>Department Details</h3>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginBottom: '20px',
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: '#f8f9fa',
                    borderBottom: '2px solid #dee2e6',
                  }}
                >
                  <th style={{ padding: '12px', textAlign: 'left' }}>
                    Department
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>
                    Members
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>
                    Status
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>
                    Shift Timing
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>
                    Member List
                  </th>
                </tr>
              </thead>
              <tbody>
                {auditData.departments.map((dept, idx) => (
                  <tr
                    key={dept.departmentId}
                    style={{
                      borderBottom: '1px solid #dee2e6',
                      backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa',
                    }}
                  >
                    <td
                      style={{
                        padding: '12px',
                        fontWeight: 'bold',
                        color: dept.isHidden ? '#999' : '#000',
                      }}
                    >
                      {dept.departmentName}
                      {dept.isHidden && <span> (Hidden)</span>}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <strong>{dept.totalMembers}</strong>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 8px',
                          borderRadius: '3px',
                          fontSize: '0.85em',
                          backgroundColor: dept.hasMembers
                            ? '#d4edda'
                            : '#f8d7da',
                          color: dept.hasMembers ? '#155724' : '#721c24',
                        }}
                      >
                        {dept.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '0.9em' }}>
                      {dept.shiftTiming}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {dept.members.length === 0 ? (
                        <em style={{ color: '#999' }}>No members</em>
                      ) : (
                        <ul style={{ margin: 0, paddingLeft: '20px' }}>
                          {dept.members.map((member) => (
                            <li key={member.id}>
                              {member.displayName}
                              {member.isPrimary ? (
                                <span
                                  style={{
                                    marginLeft: '8px',
                                    padding: '2px 6px',
                                    backgroundColor: '#007bff',
                                    color: 'white',
                                    borderRadius: '3px',
                                    fontSize: '0.75em',
                                  }}
                                >
                                  Primary
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color = '#007bff',
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div
      style={{
        padding: '15px',
        backgroundColor: '#fff',
        border: `2px solid ${color}`,
        borderRadius: '4px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '2em', fontWeight: 'bold', color }}>{value}</div>
      <div style={{ fontSize: '0.9em', color: '#666', marginTop: '5px' }}>
        {label}
      </div>
    </div>
  );
}
