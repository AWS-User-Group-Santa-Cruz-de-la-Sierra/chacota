import { can, canAssignRole, Role } from '@chacota/core';
import { getUsers, listMembers } from '@chacota/db';
import { getTranslations } from 'next-intl/server';
import { SubmitButton } from '@/components/submit-button';
import { Badge, Card } from '@/components/ui';
import { requireOrgAccess } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { changeRoleAction, createInviteAction, removeMemberAction } from '@/app/[locale]/app/actions';
import { InviteForm } from './invite-form';

export default async function Members({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org, role, user } = await requireOrgAccess(slug);
  const t = await getTranslations();
  const members = await listMembers(getDb(), org.id);
  const users = await getUsers(getDb(), members.map((m) => m.userId));
  const assignable = Role.options.filter((r) => canAssignRole(role, r));
  const order = { owner: 0, admin: 1, editor: 2 } as const;

  return (
    <div className="flex flex-col gap-6">
      {can(role, 'members.manage') && (
        <Card>
          <h2 className="mb-4 font-display text-2xl font-bold">{t('members.invite')}</h2>
          <InviteForm action={createInviteAction.bind(null, slug)} roles={assignable} />
        </Card>
      )}
      <ul className="divide-y divide-noche-3 rounded-2xl border border-noche-3">
        {members
          .sort((a, b) => order[a.role] - order[b.role])
          .map((m) => {
            const u = users.get(m.userId);
            const manageable = canAssignRole(role, m.role) && m.userId !== user.id;
            return (
              <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex flex-col">
                  <span className="font-semibold">
                    {u?.name ?? m.userId} {m.userId === user.id && <span className="text-niebla">({t('members.you')})</span>}
                  </span>
                  {u?.email && <span className="text-sm text-niebla">{u.email}</span>}
                </div>
                {manageable ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={changeRoleAction.bind(null, slug)} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={m.userId} />
                      <label className="sr-only" htmlFor={`role-${m.userId}`}>
                        {t('members.changeRole')}
                      </label>
                      <select
                        id={`role-${m.userId}`}
                        name="role"
                        defaultValue={m.role}
                        className="min-h-11 rounded-lg border border-noche-3 bg-noche px-2"
                      >
                        {assignable.map((r) => (
                          <option key={r} value={r}>
                            {t(`roles.${r}`)}
                          </option>
                        ))}
                      </select>
                      <SubmitButton variant="secondary">{t('common.save')}</SubmitButton>
                    </form>
                    <form action={removeMemberAction.bind(null, slug)}>
                      <input type="hidden" name="userId" value={m.userId} />
                      <SubmitButton variant="danger">{t('members.remove')}</SubmitButton>
                    </form>
                  </div>
                ) : (
                  <Badge>{t(`roles.${m.role}`)}</Badge>
                )}
              </li>
            );
          })}
      </ul>
    </div>
  );
}
