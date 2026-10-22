
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="dashboard">
      <div class="heading">
        <div>
          <h1>Admin Dashboard</h1>
          <p>Manage your Call Guardian AI platform.</p>
        </div>

        <a routerLink="/admin/clients">
          Manage Clients →
        </a>
      </div>

      <div class="cards">
        <article>
          <span>Customer Accounts</span>
          <strong>—</strong>
          <small>Connected in the next step</small>
        </article>

        <article>
          <span>Active Phone Numbers</span>
          <strong>—</strong>
          <small>Platform-wide overview</small>
        </article>

        <article>
          <span>Total Calls</span>
          <strong>—</strong>
          <small>All customer accounts</small>
        </article>

        <article>
          <span>Monthly Revenue</span>
          <strong>—</strong>
          <small>Billing integration pending</small>
        </article>
      </div>
    </section>
  `,
  styles: [`
    .heading {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      margin-bottom: 28px;
    }

    h1 { margin: 0 0 8px; font-size: 28px; }

    p, small { color: #8490a5; }

    .heading a {
      background: #4169e1;
      color: white;
      padding: 12px 18px;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 600;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 18px;
    }

    article {
      background: white;
      padding: 24px;
      border-radius: 15px;
      border: 1px solid #e7ebf2;
      display: grid;
      gap: 14px;
    }

    article span { color: #69768c; font-size: 13px; }
    article strong { font-size: 32px; }
    article small { font-size: 12px; }

    @media (max-width: 1100px) {
      .cards { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 550px) {
      .cards { grid-template-columns: 1fr; }
      .heading { flex-direction: column; align-items: start; }
    }
  `],
})
export class AdminDashboard {}
