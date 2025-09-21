const { 
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
  ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits 
} = require('discord.js');

function checkBotPermissions(channel, requiredPermissions, commandName) {
  const botPermissions = channel.permissionsFor(channel.client.user);
  const missingPermissions = requiredPermissions.filter(perm => !botPermissions.has(perm));
  if (missingPermissions.length > 0) {
    const missing = missingPermissions.map(p => Object.keys(PermissionFlagsBits).find(key => PermissionFlagsBits[key] === p)).join(', ');
    return { valid: false, missing };
  }
  return { valid: true };
}

function createSupportEmbed(title, description, color) {
  return new EmbedBuilder()
    .setTitle(`📩 ${title}`)
    .setDescription(description)
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: 'Hệ Thống Hỗ Trợ' });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hotro')
    .setDescription('Tạo ticket hỗ trợ với đội ngũ admin.'),
  async initPrompt(client, config) {
    const supportPromptChannel = client.channels.cache.get(config.supportChannelId);
    if (supportPromptChannel) {
      try {
        const messages = await supportPromptChannel.messages.fetch({ limit: 100 });
        for (const message of messages.values()) {
          if (message.author.id === client.user.id && message.components.length > 0) {
            await message.delete();
            console.log('Đã xóa tin nhắn cũ chứa nút hỗ trợ');
          }
        }
      } catch (error) {
        console.error('Lỗi khi xóa tin nhắn cũ trong kênh hỗ trợ:', error);
      }

      const embed = createSupportEmbed(
        'Hệ Thống Ticket Hỗ Trợ',
        'Nhấn nút bên dưới để gửi yêu cầu hỗ trợ cho admin.',
        0x00bfff // Màu xanh dương
      );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('hotro_button')
          .setLabel('🆘 Gửi Hỗ Trợ')
          .setStyle(ButtonStyle.Primary)
      );

      try {
        await supportPromptChannel.send({ embeds: [embed], components: [row] });
        console.log('Đã gửi tin nhắn gợi ý hỗ trợ đến kênh ');
      } catch (error) {
        console.error('Lỗi khi gửi tin nhắn gợi ý hỗ trợ:', error);
      }
    } else {
      console.error('Không tìm thấy kênh với ID ');
    }
  },
  async execute(interaction, client, confessionCounter, incrementCounter, config) {
    // Xử lý lệnh /hotro
    if (interaction.isCommand()) {
      const requiredPermissions = [
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ViewChannel
      ];
      const permissionCheck = checkBotPermissions(interaction.channel, requiredPermissions, 'Hỗ Trợ');
      if (!permissionCheck.valid) {
        return interaction.reply({
          content: `❌ Không thể tạo ticket! Bot thiếu quyền: ${permissionCheck.missing}`,
          flags: 64
        });
      }

      const embed = createSupportEmbed(
        'Hệ Thống Ticket Hỗ Trợ',
        'Tin nhắn hỗ trợ đã được gửi trong kênh <#' + (config.supportChannelId) + '>. Nhấn nút "Gửi Hỗ Trợ" tại đó để tạo ticket.',
        0x00bfff // Màu xanh dương
      );

      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    // Xử lý nút gửi hỗ trợ
    if (interaction.isButton() && interaction.customId === 'hotro_button') {
      const modal = new ModalBuilder()
        .setCustomId('hotro_modal')
        .setTitle('Tạo Ticket Hỗ Trợ');

      const titleInput = new TextInputBuilder()
        .setCustomId('hotro_title')
        .setLabel('Tiêu đề (tối đa 100 ký tự)')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(true)
        .setPlaceholder('Nhập tiêu đề vấn đề...');

      const contentInput = new TextInputBuilder()
        .setCustomId('hotro_content')
        .setLabel('Nội dung hỗ trợ (tối đa 1000 ký tự)')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1000)
        .setRequired(true)
        .setPlaceholder('Mô tả chi tiết vấn đề của bạn...');

      const titleRow = new ActionRowBuilder().addComponents(titleInput);
      const contentRow = new ActionRowBuilder().addComponents(contentInput);
      modal.addComponents(titleRow, contentRow);

      await interaction.showModal(modal);
    }

    // Xử lý modal gửi ticket
    if (interaction.isModalSubmit() && interaction.customId === 'hotro_modal') {
      const title = interaction.fields.getTextInputValue('hotro_title').trim();
      const content = interaction.fields.getTextInputValue('hotro_content').trim();
      const guild = interaction.guild;
      const user = interaction.user;

      // Kiểm tra quyền tạo kênh
      const requiredPermissions = [
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks
      ];
      const permissionCheck = checkBotPermissions(interaction.channel, requiredPermissions, 'Tạo Kênh Hỗ Trợ');
      if (!permissionCheck.valid) {
        return interaction.reply({
          content: `❌ Không thể tạo ticket! Bot thiếu quyền: ${permissionCheck.missing}`,
          flags: 64
        });
      }

      // Kiểm tra đã có ticket chưa
      const existing = guild.channels.cache.find(
        c => c.name === `hotro-${user.id}` && c.type === ChannelType.GuildText
      );
      if (existing) {
        const embed = createSupportEmbed(
          'Ticket Đã Tồn Tại',
          `Bạn đã có một ticket mở tại: <#${existing.id}>`,
          0xffa500 // Màu cam
        );
        return interaction.reply({ embeds: [embed], flags: 64 });
      }

      // Tạo ticket mới
      try {
        const ticketChannel = await guild.channels.create({
          name: `hotro-${user.id}`,
          type: ChannelType.GuildText,
          topic: `Ticket của ${user.tag} - ${user.id}`,
          permissionOverwrites: [
            { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
            { 
              id: user.id, 
              allow: [
                PermissionFlagsBits.ViewChannel, 
                PermissionFlagsBits.SendMessages, 
                PermissionFlagsBits.AttachFiles, 
                PermissionFlagsBits.ReadMessageHistory
              ] 
            },
            { 
              id: client.user.id, 
              allow: [
                PermissionFlagsBits.ViewChannel, 
                PermissionFlagsBits.SendMessages, 
                PermissionFlagsBits.ManageChannels, 
                PermissionFlagsBits.EmbedLinks
              ] 
            }
            // Nếu có role admin, thêm vào đây
            // { id: 'ADMIN_ROLE_ID_HERE', allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
          ]
        });

        const embed = createSupportEmbed(
          `Ticket Hỗ Trợ: ${title}`,
          `**Người dùng:** <@${user.id}>\n**Nội dung:**\n${content}\n\n🕐 **Thời gian:** <t:${Math.floor(Date.now() / 1000)}:F>`,
          0x00bfff // Màu xanh dương
        );

        const closeRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('🔒 Đóng Ticket')
            .setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({ content: `<@${user.id}>`, embeds: [embed], components: [closeRow] });

        return interaction.reply({
          embeds: [createSupportEmbed('Ticket Đã Tạo', `✅ Ticket của bạn đã được mở tại <#${ticketChannel.id}>`, 0x00ff00)], // Màu xanh lá
          flags: 64
        });
      } catch (error) {
        console.error('Lỗi khi tạo kênh hỗ trợ:', error);
        return interaction.reply({
          embeds: [createSupportEmbed('Lỗi Tạo Ticket', 'Có lỗi xảy ra khi tạo ticket hỗ trợ!', 0xff0000)], // Màu đỏ
          flags: 64
        });
      }
    }

    // Xử lý nút đóng ticket
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
      try {
        await interaction.channel.delete();
      } catch (error) {
        console.error('Lỗi khi đóng ticket:', error);
        await interaction.reply({
          content: 'Có lỗi xảy ra khi đóng ticket!',
          flags: 64
        });
      }
    }
  }
};