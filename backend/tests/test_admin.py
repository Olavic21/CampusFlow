"""Phase 5 — Console d'administration : gestion des utilisateurs (admin)."""


def test_admin_users_requires_admin(client, db_session, student_headers):
    assert client.get("/admin/users").status_code == 401
    assert (
        client.get("/admin/users", headers=student_headers).status_code == 403
    )


def test_admin_lists_and_updates_users(client, db_session, admin_headers, student_headers):
    listed = client.get("/admin/users", headers=admin_headers)
    assert listed.status_code == 200
    users = listed.json()
    assert len(users) >= 2  # admin + student (fixtures)
    target = next(u for u in users if u["role"] == "student")

    promoted = client.patch(
        f"/admin/users/{target['id']}",
        json={"role": "staff"},
        headers=admin_headers,
    )
    assert promoted.status_code == 200
    assert promoted.json()["role"] == "staff"

    deactivated = client.patch(
        f"/admin/users/{target['id']}",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False

    # Le compte désactivé ne peut plus s'authentifier
    assert (
        client.get("/auth/me", headers=student_headers).status_code == 401
    )


def test_admin_cannot_deactivate_self(client, db_session, admin_headers):
    me = client.get("/auth/me", headers=admin_headers).json()
    response = client.patch(
        f"/admin/users/{me['id']}",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert response.status_code == 400


def test_admin_invalid_role_400(client, db_session, admin_headers, student_headers):
    target = client.get("/admin/users", headers=admin_headers).json()
    victim = next(u for u in target if u["role"] == "student")
    response = client.patch(
        f"/admin/users/{victim['id']}",
        json={"role": "superuser"},
        headers=admin_headers,
    )
    assert response.status_code == 400