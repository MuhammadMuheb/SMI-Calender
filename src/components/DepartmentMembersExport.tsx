/**
 * Department Members Export Component
 *
 * Shows exact members for each department/field in the system.
 * Integrates with AppDataContext to display real data.
 */

import { useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';

export function DepartmentMembersExport() {
  const { jobRoles, users, roleAssignments } = useAppData();

  const departmentMemberships = useMemo(() => {
    return jobRoles.map((role) => {
      // Get all assignments for this department
      const assignmentsForRole = roleAssignments.filter(
        (a) => a.jobRoleId === role.id
      );

      // Get user details for each assignment
      const members = assignmentsForRole
        .map((assignment) => {
          const user = users.find((u) => u.id === assignment.userId);
          return user
            ? {
                id: user.id,
                displayName: user.displayName ?? user.username ?? 'Unknown',
                username: user.username,
                isPrimary: assignment.isPrimary,
              }
            : null;
        })
        .filter((m) => m !== null);

      return {
        id: role.id,
        name: role.name,
        isHidden: role.isHidden,
        shiftStart: role.shiftStartTime,
        shiftEnd: role.shiftEndTime,
        totalMembers: members.length,
        members,
      };
    });
  }, [jobRoles, users, roleAssignments]);

  const totalUniqueMembersSet = new Set(roleAssignments.map((a) => a.userId));

  const generateMarkdown = () => {
    let md = '# Department Membership Report\n\n';
    md += `Generated: ${new Date().toLocaleString()}\n\n`;
    md += `**Summary**\n`;
    md += `- Total Departments: ${departmentMemberships.length}\n`;
    md += `- Departments with Members: ${departmentMemberships.filter((d) => d.totalMembers > 0).length}\n`;
    md += `- Empty Departments: ${departmentMemberships.filter((d) => d.totalMembers === 0).length}\n`;
    md += `- Total Unique Members: ${totalUniqueMembersSet.size}\n\n`;

    for (const dept of departmentMemberships) {
      md += `## ${dept.name}\n`;
      md += `- **Status**: ${dept.totalMembers === 0 ? 'EMPTY ⚠️' : 'ACTIVE ✓'}\n`;
      md += `- **Total Members**: ${dept.totalMembers}\n`;
      md += `- **Shift**: ${dept.shiftStart} - ${dept.shiftEnd}\n`;

      if (dept.members.length === 0) {
        md += `- **Members**: None\n\n`;
      } else {
        md += `- **Members**:\n`;
        for (const member of dept.members) {
          md += `  - ${member.displayName} (${member.username})${member.isPrimary ? ' [PRIMARY]' : ' [SECONDARY]'}\n`;
        }
        md += '\n';
      }
    }

    return md;
  };

  const generateCSV = () => {
    let csv = 'Department,Total Members,Status,Member Names,Member Usernames\n';

    for (const dept of departmentMemberships) {
      const memberNames = dept.members.map((m) => m.displayName).join('; ') || 'None';
      const memberUsernames = dept.members.map((m) => m.username).join('; ') || 'None';
      const status = dept.totalMembers === 0 ? 'EMPTY' : 'ACTIVE';

      const row = [
        `"${dept.name}"`,
        dept.totalMembers,
        status,
        `"${memberNames}"`,
        `"${memberUsernames}"`,
      ].join(',');

      csv += row + '\n';
    }

    return csv;
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const element = document.createElement('a');
    element.setAttribute(
      'href',
      `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`
    );
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadMarkdown = () => {
    const md = generateMarkdown();
    downloadFile(md, `department_members_${new Date().toISOString().split('T')[0]}.md`, 'text/markdown');
  };

  const handleDownloadCSV = () => {
    const csv = generateCSV();
    downloadFile(csv, `department_members_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
  };

  const handleCopyToClipboard = () => {
    const md = generateMarkdown();
    navigator.clipboard.writeText(md).then(() => {
      alert('Department membership report copied to clipboard!');
    });
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Department Members Report</h2>
      <p>View all members assigned to each field/department</p>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={handleDownloadMarkdown}
          style={{
            padding: '10px 15px',
            backgroundColor: '#0066cc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          📄 Download as Markdown
        </button>
        <button
          onClick={handleDownloadCSV}
          style={{
            padding: '10px 15px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          📊 Download as CSV
        </button>
        <button
          onClick={handleCopyToClipboard}
          style={{
            padding: '10px 15px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          📋 Copy to Clipboard
        </button>
      </div>

      {/* Summary Statistics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '10px',
          marginBottom: '20px',
        }}
      >
        <StatBox
          label="Total Departments"
          value={departmentMemberships.length}
        />
        <StatBox
          label="With Members"
          value={departmentMemberships.filter((d) => d.totalMembers > 0).length}
          color="#28a745"
        />
        <StatBox
          label="Empty"
          value={departmentMemberships.filter((d) => d.totalMembers === 0).length}
          color={
            departmentMemberships.filter((d) => d.totalMembers === 0).length > 0
              ? '#ffc107'
              : '#ccc'
          }
        />
        <StatBox
          label="Total Members"
          value={totalUniqueMembersSet.size}
          color="#0066cc"
        />
      </div>

      {/* Detailed Listings */}
      <h3>Departments and Members</h3>
      <div style={{ display: 'grid', gap: '20px' }}>
        {departmentMemberships.map((dept) => (
          <div
            key={dept.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '15px',
              backgroundColor: dept.totalMembers === 0 ? '#fff5f5' : '#f9f9f9',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <h4 style={{ margin: '0 0 10px 0' }}>
                  {dept.name}
                  {dept.isHidden && <span style={{ fontSize: '0.8em', color: '#999' }}> (Hidden)</span>}
                </h4>
                <p style={{ margin: '5px 0', fontSize: '0.9em', color: '#666' }}>
                  <strong>Shift:</strong> {dept.shiftStart} - {dept.shiftEnd}
                </p>
              </div>
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  backgroundColor: dept.totalMembers === 0 ? '#f8d7da' : '#d4edda',
                  color: dept.totalMembers === 0 ? '#721c24' : '#155724',
                  fontSize: '0.9em',
                  fontWeight: 'bold',
                }}
              >
                {dept.totalMembers === 0 ? '⚠️ EMPTY' : '✓ ACTIVE'}
              </div>
            </div>

            <div style={{ marginTop: '10px' }}>
              <strong>Members ({dept.totalMembers}):</strong>
              {dept.members.length === 0 ? (
                <p style={{ color: '#999', fontStyle: 'italic', margin: '5px 0' }}>
                  No members assigned
                </p>
              ) : (
                <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
                  {dept.members.map((member) => (
                    <li key={member.id} style={{ margin: '5px 0' }}>
                      <strong>{member.displayName}</strong> <span style={{ color: '#666' }}>({member.username})</span>
                      {member.isPrimary ? (
                        <span
                          style={{
                            marginLeft: '8px',
                            padding: '2px 6px',
                            backgroundColor: '#0066cc',
                            color: 'white',
                            borderRadius: '3px',
                            fontSize: '0.75em',
                          }}
                        >
                          PRIMARY
                        </span>
                      ) : (
                        <span
                          style={{
                            marginLeft: '8px',
                            padding: '2px 6px',
                            backgroundColor: '#e9ecef',
                            color: '#495057',
                            borderRadius: '3px',
                            fontSize: '0.75em',
                          }}
                        >
                          SECONDARY
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Export Format Preview */}
      <h3 style={{ marginTop: '30px' }}>Raw Data Preview</h3>
      <details style={{ marginBottom: '20px' }}>
        <summary style={{ cursor: 'pointer', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          View JSON Data
        </summary>
        <pre
          style={{
            backgroundColor: '#f5f5f5',
            padding: '15px',
            borderRadius: '4px',
            overflow: 'auto',
            marginTop: '10px',
          }}
        >
          {JSON.stringify(
            {
              departments: departmentMemberships,
              summary: {
                totalDepartments: departmentMemberships.length,
                departmentsWithMembers: departmentMemberships.filter((d) => d.totalMembers > 0).length,
                emptyDepartments: departmentMemberships.filter((d) => d.totalMembers === 0).length,
                totalUniqueMembers: totalUniqueMembersSet.size,
              },
            },
            null,
            2
          )}
        </pre>
      </details>
    </div>
  );
}

function StatBox({
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
      <div style={{ fontSize: '1.8em', fontWeight: 'bold', color }}>{value}</div>
      <div style={{ fontSize: '0.85em', color: '#666', marginTop: '5px' }}>{label}</div>
    </div>
  );
}
