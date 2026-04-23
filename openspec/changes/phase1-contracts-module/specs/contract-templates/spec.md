## ADDED Requirements

### Requirement: Contract templates store reusable HTML with placeholders
The system SHALL have a `contract_templates` table storing HTML content with `{{placeholder}}` syntax. Templates can be created, edited, and deleted by admin/manager.

#### Scenario: Template with valid placeholders is saved
- **WHEN** an admin saves a template containing `{{tenant_name}}` and `{{rent_amount}}`
- **THEN** the template is stored and available for contract creation

### Requirement: Generating a contract from a template renders a snapshot
The system SHALL replace all `{{placeholder}}` tokens with real data when creating a contract from a template. The rendered HTML is stored as `content_html` on the contract and never changes.

#### Scenario: Rendered contract contains tenant name
- **WHEN** a contract is created from a template with `{{tenant_name}}`
- **THEN** `content_html` contains the actual tenant's name, not the placeholder

#### Scenario: Template change does not affect existing contracts
- **WHEN** a template is edited after a contract was created from it
- **THEN** the existing contract's `content_html` is unchanged

### Requirement: Template editor shows live preview
The system SHALL show a live preview pane in `ContractTemplateEditor.vue` that renders the template HTML with sample data as the user types.

#### Scenario: Preview updates on template edit
- **WHEN** an admin edits the template HTML
- **THEN** the preview pane refreshes to show the rendered output with sample placeholder values
