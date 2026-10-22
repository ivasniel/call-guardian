import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Pagination } from '../../shared/components/pagination/pagination';
import { inject } from '@angular/core';
import { AppNotificationService } from '../../shared/services/app-notification.service';

interface Contact {
  id: number;
  name: string;
  phone: string;
  category: string;
  organization: string;
  notes: string;
}

@Component({
  selector: 'app-contacts',
  standalone: true,
  imports: [FormsModule, Pagination],
  templateUrl: './contacts.html',
  styleUrl: './contacts.scss',
})
export class Contacts {
  private readonly notify = inject(AppNotificationService);
  search = '';
  categoryFilter = 'ALL';
  currentPage = 1;
  pageSize = 10;

  showForm = false;
  editingId: number | null = null;
  error = '';
  success = '';

  readonly categories = ['PERSONAL', 'BUSINESS', 'JOB', 'SCHOOL', 'HEALTH', 'OTHER'];

  contacts: Contact[] = [
    {
      id: 1,
      name: 'Michael Rodriguez',
      phone: '+13055550142',
      category: 'BUSINESS',
      organization: 'Miami Services',
      notes: 'Existing customer',
    },
    {
      id: 2,
      name: 'Sarah Wilson',
      phone: '+19545550112',
      category: 'PERSONAL',
      organization: '',
      notes: 'Known contact',
    },
    {
      id: 3,
      name: 'Medical Office',
      phone: '+17865550108',
      category: 'HEALTH',
      organization: 'Medical Center',
      notes: 'Appointment calls',
    },
    {
      id: 4,
      name: 'Recruitment Agency',
      phone: '+13055550176',
      category: 'JOB',
      organization: 'Recruiting Company',
      notes: 'Software engineering opportunities',
    },
  ];

  form: Omit<Contact, 'id'> = this.emptyForm();

  private emptyForm(): Omit<Contact, 'id'> {
    return {
      name: '',
      phone: '',
      category: 'PERSONAL',
      organization: '',
      notes: '',
    };
  }

  get filteredContacts(): Contact[] {
    const query = this.search.trim().toLowerCase();

    return this.contacts.filter((contact) => {
      const matchesSearch =
        !query ||
        contact.name.toLowerCase().includes(query) ||
        contact.phone.includes(query) ||
        contact.organization.toLowerCase().includes(query);

      const matchesCategory =
        this.categoryFilter === 'ALL' || contact.category === this.categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }

  get totalItems(): number {
    return this.filteredContacts.length;
  }

  get paginatedContacts(): Contact[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredContacts.slice(start, start + this.pageSize);
  }

  onFiltersChange(): void {
    this.currentPage = 1;
  }

  onPageChange(page: number): void {
    this.currentPage = page;
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
  }

  openCreate(): void {
    this.editingId = null;
    this.form = this.emptyForm();
    this.error = '';
    this.showForm = true;
  }

  openEdit(contact: Contact): void {
    this.editingId = contact.id;
    this.form = {
      name: contact.name,
      phone: contact.phone,
      category: contact.category,
      organization: contact.organization,
      notes: contact.notes,
    };
    this.error = '';
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingId = null;
    this.error = '';
  }

  saveContact(): void {
    const name = this.form.name.trim();
    const phone = this.form.phone.trim();

    this.error = '';

    if (!name) {
      this.error = 'Contact name is required.';
      return;
    }

    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      this.error = 'Enter a valid phone number in E.164 format.';
      return;
    }

    const duplicate = this.contacts.some(
      (contact) => contact.phone === phone && contact.id !== this.editingId,
    );

    if (duplicate) {
      this.error = 'A contact with this phone number already exists.';
      return;
    }

    const payload = {
      name,
      phone,
      category: this.form.category,
      organization: this.form.organization.trim(),
      notes: this.form.notes.trim(),
    };

    if (this.editingId !== null) {
      this.contacts = this.contacts.map((contact) =>
        contact.id === this.editingId ? { ...contact, ...payload } : contact,
      );
      this.notify.success('Contact updated', 'The contact information was updated (demo only).');
    } else {
      const nextId = Math.max(0, ...this.contacts.map((contact) => contact.id)) + 1;

      this.contacts = [{ id: nextId, ...payload }, ...this.contacts];

      this.notify.success('Contact added', 'The new contact was added (demo only).');
    }

    this.currentPage = 1;
    this.closeForm();
  }

  async deleteContact(contact: Contact): Promise<void> {
    const confirmed = await this.notify.confirm({
      title: 'Delete contact?',
      message: `Are you sure you want to remove "${contact.name}"?`,
      confirmText: 'Delete contact',
      danger: true,
    });

    if (!confirmed) return;

    this.contacts = this.contacts.filter((item) => item.id !== contact.id);

    const lastPage = Math.max(1, Math.ceil(this.totalItems / this.pageSize));

    this.currentPage = Math.min(this.currentPage, lastPage);

    this.notify.success('Contact deleted', `${contact.name} was removed from your contacts.`);
  }
}
