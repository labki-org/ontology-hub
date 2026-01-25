import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InlineEditField } from './InlineEditField'

describe('InlineEditField', () => {
  it('renders value in view mode', () => {
    render(
      <InlineEditField
        value="Test Value"
        onSave={vi.fn()}
      />
    )

    expect(screen.getByText('Test Value')).toBeInTheDocument()
  })

  it('renders label and value when label is provided', () => {
    render(
      <InlineEditField
        value="Test Value"
        onSave={vi.fn()}
        label="Field Name"
      />
    )

    expect(screen.getByText('Field Name:')).toBeInTheDocument()
    expect(screen.getByText('Test Value')).toBeInTheDocument()
  })

  it('renders placeholder when value is empty', () => {
    render(
      <InlineEditField
        value=""
        onSave={vi.fn()}
        placeholder="Enter value"
      />
    )

    expect(screen.getByText('Enter value')).toBeInTheDocument()
  })

  it('shows edit icon when hovering (via aria-label)', () => {
    render(
      <InlineEditField
        value="Test Value"
        onSave={vi.fn()}
        isEditable={true}
      />
    )

    // Icon buttons are present in the DOM (hidden via CSS until hover)
    expect(screen.getByLabelText('Edit')).toBeInTheDocument()
  })

  it('shows delete icon when isDeletable is true', () => {
    render(
      <InlineEditField
        value="Test Value"
        onSave={vi.fn()}
        isDeletable={true}
      />
    )

    expect(screen.getByLabelText('Delete')).toBeInTheDocument()
  })

  it('enters edit mode when pencil clicked', async () => {
    const user = userEvent.setup()
    render(
      <InlineEditField
        value="Test Value"
        onSave={vi.fn()}
        isEditable={true}
      />
    )

    await user.click(screen.getByLabelText('Edit'))

    // Input should appear with value pre-filled
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('Test Value')
  })

  it('calls onSave with new value when check clicked', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <InlineEditField
        value="Test Value"
        onSave={onSave}
        isEditable={true}
      />
    )

    // Enter edit mode
    await user.click(screen.getByLabelText('Edit'))

    // Change value
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'New Value')

    // Click save
    await user.click(screen.getByLabelText('Save'))

    expect(onSave).toHaveBeenCalledWith('New Value')
  })

  it('reverts value when X clicked', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <InlineEditField
        value="Original Value"
        onSave={onSave}
        isEditable={true}
      />
    )

    // Enter edit mode
    await user.click(screen.getByLabelText('Edit'))

    // Change value
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Modified Value')

    // Click cancel
    await user.click(screen.getByLabelText('Cancel'))

    // Should be back to view mode with original value
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('Original Value')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('reverts value when Escape pressed', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <InlineEditField
        value="Original Value"
        onSave={onSave}
        isEditable={true}
      />
    )

    // Enter edit mode
    await user.click(screen.getByLabelText('Edit'))

    // Change value
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Modified Value')

    // Press Escape
    await user.keyboard('{Escape}')

    // Should be back to view mode with original value
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('Original Value')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves value when Enter pressed', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <InlineEditField
        value="Test Value"
        onSave={onSave}
        isEditable={true}
      />
    )

    // Enter edit mode
    await user.click(screen.getByLabelText('Edit'))

    // Change value and press Enter
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'New Value{Enter}')

    expect(onSave).toHaveBeenCalledWith('New Value')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('calls onDelete when trash clicked', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(
      <InlineEditField
        value="Test Value"
        onSave={vi.fn()}
        onDelete={onDelete}
        isDeletable={true}
      />
    )

    await user.click(screen.getByLabelText('Delete'))

    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('hides delete icon when isDeletable=false', () => {
    render(
      <InlineEditField
        value="Test Value"
        onSave={vi.fn()}
        isDeletable={false}
      />
    )

    expect(screen.queryByLabelText('Delete')).not.toBeInTheDocument()
  })

  it('hides edit icon when isEditable=false', () => {
    render(
      <InlineEditField
        value="Test Value"
        onSave={vi.fn()}
        isEditable={false}
      />
    )

    expect(screen.queryByLabelText('Edit')).not.toBeInTheDocument()
  })

  it('auto-focuses input when entering edit mode', async () => {
    const user = userEvent.setup()
    render(
      <InlineEditField
        value="Test Value"
        onSave={vi.fn()}
        isEditable={true}
      />
    )

    await user.click(screen.getByLabelText('Edit'))

    const input = screen.getByRole('textbox')
    expect(input).toHaveFocus()
  })
})
